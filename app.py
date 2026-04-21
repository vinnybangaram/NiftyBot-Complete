from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
import os
from datetime import datetime

from models import db, Trade
from data.data_fetcher import get_nifty_data
from indicators.indicators import add_indicators
from strategy.strategy import generate_signal
from options_engine.atm_selector import get_atm_strike
from options_engine.oi_analysis import analyze_oi



import config
from execution.trade_tracker import (
    validate_trade,
    get_trade_count_today,
    export_filtered_to_excel,
    get_active_trade_count,
    check_exit,
    end_of_day_report,
    manual_exit_all_trades
)





app = Flask(__name__, static_folder='static', static_url_path='')
CORS(app, resources={r"/*": {"origins": "*"}})

# Database Configuration
basedir = os.path.abspath(os.path.dirname(__file__))
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + os.path.join(basedir, 'trades.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db.init_app(app)

# Global State
trading_active = False
awaiting_confirmation = False
pending_trade = None
last_traded_trend = None
pending_pullback = None


# Initialize Database
with app.app_context():
    db.create_all()
    


@app.route("/data")
def get_data():

    global trading_active, last_traded_trend, pending_pullback
    filter_date = request.args.get('date') # YYYY-MM-DD
    interval = request.args.get('interval', '5m') # 🚀 DYNAMIC INTERVAL

    # 1️⃣ FETCH DATA
    df = get_nifty_data(interval=interval)

    if df is None or df.empty:
        return jsonify({"error": "No Data"})

    df = add_indicators(df)
    nifty_price = df["Close"].iloc[-1]
    atm = get_atm_strike(nifty_price)

    # 2️⃣ TRADE EXECUTION
    # Exit Check (Always running if active, but can check anyway)
    check_exit(nifty_price)

    oi = analyze_oi(atm)
    support = oi["support"]
    resistance = oi["resistance"]

    # Entry Logic (Only if system is RUNNING)
    if trading_active:

        signal = generate_signal(df)

        ema20 = df["EMA20"].iloc[-1]
        ema50 = df["EMA50"].iloc[-1]
        trend = "UPTREND" if ema20 > ema50 else "DOWNTREND"

        warnings = []
        momentum = abs(df["Close"].iloc[-1] - df["Close"].iloc[-5]) if len(df) >= 5 else 0
        if momentum < 25: warnings.append("Low Momentum")

        last = df.iloc[-1]
        candle_body = abs(last["Close"] - last["Open"])
        candle_range = last["High"] - last["Low"]
        if candle_range == 0 or candle_body < (0.4 * candle_range): warnings.append("Weak Candle")

        if abs(resistance - nifty_price) < 10 or abs(nifty_price - support) < 10: warnings.append("Near Level")

        final_signal = "WAIT ⏳"
        entry_data = None
        
        # Determine candidate signal and entry
        candidate_signal = None
        candidate_entry = None

        # --- PULLBACK ENGINE ---
        if pending_pullback:
            # Check for trigger
            is_triggered = False
            is_missed = False
            
            pb_sig = pending_pullback["signal"]
            pb_price = pending_pullback["pullback_price"]
            br_price = pending_pullback["breakout_price"]
            
            if "CALL" in pb_sig:
                if nifty_price <= pb_price:
                    is_triggered = True
                    candidate_signal = "BUY CALL 🚀 (A+ PULLBACK ENTRY)"
                    # New SL and Target based on pullback price
                    candidate_entry = (nifty_price, nifty_price - 30, nifty_price + 60)
                elif nifty_price >= br_price + 25:
                    is_missed = True
            elif "PUT" in pb_sig:
                if nifty_price >= pb_price:
                    is_triggered = True
                    candidate_signal = "BUY PUT 🔻 (A+ PULLBACK ENTRY)"
                    candidate_entry = (nifty_price, nifty_price + 30, nifty_price - 60)
                elif nifty_price <= br_price - 25:
                    is_missed = True
                    
            if is_missed:
                pending_pullback = None
                signal_to_return = "WAIT ⏳ (Pullback Missed)"
            elif not is_triggered:
                signal_to_return = f"WAIT ⏳ (Waiting for Pullback to {pb_price})"

            if is_triggered:
                # Bypass validation, trust the setup
                trend = pending_pullback["trend"]
                pending_pullback = None
                
                # --- NO TRADING BLOCKE RULE (DISABLED) ---
                active_trades = get_active_trade_count()
                if active_trades >= 5:
                    signal_to_return = "BLOCKED 🚫 (Max Active Trades)"
                else:
                    from execution.trade_tracker import check_entry
                    check_entry(candidate_signal, *candidate_entry, trend=trend)
                    last_traded_trend = trend
                    signal_to_return = f"AUTO ENTRIED: {candidate_signal}"
                            
        # --- NEW SETUP DETECTION (Only if no pullback active) ---
        else:
            if trend == "UPTREND" and oi["pe_oi_change"] > oi["ce_oi_change"] and nifty_price > support:
                candidate_signal, candidate_entry = "EARLY BUY CALL ⚡", (nifty_price, nifty_price - 40, nifty_price + 80)
            elif trend == "DOWNTREND" and oi["ce_oi_change"] > oi["pe_oi_change"] and nifty_price < resistance:
                candidate_signal, candidate_entry = "EARLY BUY PUT ⚡", (nifty_price, nifty_price + 40, nifty_price - 80)
            
            if not candidate_entry:
                indicator_signal = signal
                if indicator_signal == "BUY CALL" and nifty_price > resistance and abs(nifty_price - resistance) < 15:
                    candidate_signal, candidate_entry = "BUY CALL", (resistance, resistance - 50, resistance + 100)
                elif indicator_signal == "BUY PUT" and nifty_price < support and abs(nifty_price - support) < 15:
                    candidate_signal, candidate_entry = "BUY PUT", (support, support + 50, support - 100)

            # Apply Professional Quality Filters
            if candidate_entry:
                if "Low Momentum" in warnings:
                    signal_to_return = "WAIT ⏳ (Low Momentum)"
                else:
                    is_valid, reason = validate_trade(df, candidate_signal, *candidate_entry)
                    
                    if is_valid:
                        # 🚫 ONE TRADE PER TREND RULE (DISABLED)
                        # 🚫 Anti-Gravity Rule: Max 2 Active Trades
                        active_trades = get_active_trade_count()
                        if active_trades >= 5:
                            signal_to_return = "BLOCKED 🚫 (Max Active Trades)"
                        else:
                            # Setup Validated -> ENTER PULLBACK STATE
                            pending_pullback = {
                                "signal": "CALL" if "CALL" in candidate_signal else "PUT",
                                "breakout_price": nifty_price,
                                "pullback_price": nifty_price - 10 if "CALL" in candidate_signal else nifty_price + 10,
                                "trend": trend
                            }
                            signal_to_return = f"WAIT ⏳ (A+ Setup. Waiting Pullback to {pending_pullback['pullback_price']})"
                    else:
                        signal_to_return = f"WAIT ⏳ ({reason})"
            else:
                signal_to_return = "WAIT ⏳ (Low Momentum)" if "Low Momentum" in warnings else "WAIT ⏳ (No Setup)"

    else:
        signal_to_return = "OFF (System Stopped)"


    # 3️⃣ RESPONSE
    report = end_of_day_report(nifty_price, filter_date)
    
    # 🕯️ OHLC
    ohlc = df[['Open', 'High', 'Low', 'Close', 'EMA20', 'EMA50']].reset_index()
    time_col = 'Datetime' if 'Datetime' in ohlc.columns else 'Date'
    ohlc['time'] = ohlc[time_col].apply(lambda x: int(x.timestamp()))
    chart_df = ohlc.rename(columns={
        'Open': 'open', 'High': 'high', 'Low': 'low', 'Close': 'close',
        'EMA20': 'ema20', 'EMA50': 'ema50'
    })

    active_trade = Trade.query.filter_by(status="OPEN").first()
    active_trade_data = active_trade.to_dict() if active_trade else None

    return jsonify({
        "price": round(float(nifty_price), 2),
        "atm": atm,
        "oi_data": oi,
        "signal": signal_to_return,
        "trading_active": trading_active,
        "awaiting_confirmation": awaiting_confirmation,
        "pending_trade": pending_trade,
        "active_trade": active_trade_data,
        "report": report,
        "chart_data": chart_df[['time', 'open', 'high', 'low', 'close', 'ema20', 'ema50']].to_dict(orient="records"),
        "interval": interval,
        "num_lots": config.LOT_SIZE // 65,
        "total_units": config.LOT_SIZE
    })


@app.route('/clear', methods=['POST'])
def clear_trades():
    global last_traded_trend, pending_pullback
    try:
        num_deleted = db.session.query(Trade).delete()
        db.session.commit()
        last_traded_trend = None
        pending_pullback = None
        print(f"🧹 Database Status: RESET ({num_deleted} trades removed)")
        return jsonify({"status": "success", "message": f"Deleted {num_deleted} trades"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route("/start", methods=["POST"])
def start_trading():
    global trading_active
    data = request.get_json()
    if data and "lots" in data:
        try:
            # 1 Lot = 65 Units for Nifty
            num_lots = int(data["lots"])
            config.LOT_SIZE = num_lots * 65
            print(f"📊 Engine Started with {num_lots} Lots (Total Units: {config.LOT_SIZE})")
        except: pass
        
    trading_active = True
    print("▶️ Engine Status: RUNNING")
    return jsonify({
        "status": "RUNNING", 
        "trading_active": True, 
        "num_lots": int(data.get("lots", 1)) if data else 1,
        "total_units": config.LOT_SIZE
    })


@app.route("/stop", methods=["POST"])
def stop_trading():
    global trading_active
    trading_active = False

    # Get current price
    df = get_nifty_data()
    nifty_price = df["Close"].iloc[-1] if df is not None and not df.empty else 0

    # Manual exit all open trades
    exited_count = manual_exit_all_trades(nifty_price)

    print(f"⏹ Engine Status: STOPPED ({exited_count} trades closed)")
    return jsonify({"status": "STOPPED", "trading_active": False, "exited_count": exited_count})


@app.route("/confirm", methods=["POST"])
def confirm_trade():
    global pending_trade, awaiting_confirmation, last_traded_trend
    if pending_trade:
        from execution.trade_tracker import check_entry
        check_entry(
            pending_trade["signal"], 
            pending_trade["entry"], 
            pending_trade["sl"], 
            pending_trade["target"],
            trend=pending_trade.get("trend", "N/A")
        )
        last_traded_trend = pending_trade.get("trend")
        pending_trade = None
        awaiting_confirmation = False
        return jsonify({"status": "SUCCESS", "message": "Trade Executed"})
    return jsonify({"status": "ERROR", "message": "No pending trade"})


@app.route("/reject", methods=["POST"])
def reject_trade():
    global pending_trade, awaiting_confirmation
    pending_trade = None
    awaiting_confirmation = False
    return jsonify({"status": "SUCCESS", "message": "Trade Rejected"})


@app.route("/trades")
def get_trades():
    status = request.args.get('status')
    date_str = request.args.get('date') # YYYY-MM-DD
    
    query = Trade.query
    if status and status != 'ALL':
        query = query.filter_by(status=status)
    
    if date_str:
        try:
            target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
            query = query.filter(db.func.date(Trade.entry_time) == target_date)
        except: pass

    trades = query.order_by(Trade.entry_time.desc()).all()
    return jsonify([t.to_dict() for t in trades])


@app.route("/export")
def export():
    date_str = request.args.get('date')
    query = Trade.query
    
    if date_str:
        try:
            target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
            query = query.filter(db.func.date(Trade.entry_time) == target_date)
        except: pass
        
    trades = query.order_by(Trade.entry_time.desc()).all()
    if not trades:
        return jsonify({"error": "No trades found for this filter"})

    from execution.trade_tracker import export_filtered_to_excel
    filename = export_filtered_to_excel(trades, date_str)
    return jsonify({
        "message": "Export successful",
        "file": filename
    })





# Serve React App
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    if path != "" and os.path.exists(app.static_folder + '/' + path):
        return send_from_directory(app.static_folder, path)
    else:
        return send_from_directory(app.static_folder, 'index.html')


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)