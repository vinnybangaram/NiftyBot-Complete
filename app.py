from flask import Flask, jsonify, request
from flask_cors import CORS
import os
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Environment Variable Validation
REQUIRED_ENV_VARS = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "ADMIN_EMAIL", "SECRET_KEY"]
for var in REQUIRED_ENV_VARS:
    if not os.getenv(var):
        raise EnvironmentError(f"CRITICAL CONFIGURATION ERROR: Required environment variable '{var}' is missing.")

from models import db, Trade
from data.data_fetcher import get_nifty_data
from indicators.indicators import add_indicators
from strategy.strategy import generate_signal
from options_engine.atm_selector import get_atm_strike
from options_engine.oi_analysis import analyze_oi



from config import (
    LOT_SIZE
)
from execution.trade_tracker import (
    validate_trade,
    get_trade_count_today,
    export_filtered_to_excel,
    get_active_trade_count,
    check_exit,
    end_of_day_report,
    manual_exit_all_trades
)





app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", "super-secret-key")
CORS(app, resources={r"/*": {"origins": ["http://localhost:3000"]}}, supports_credentials=True)

# Authentication Integration
from auth import auth_bp, google_bp
from auth_middleware import init_auth_middleware

app.register_blueprint(auth_bp)
app.register_blueprint(google_bp, url_prefix="/login")

# Initialize Auth Middleware (Protects routes)
init_auth_middleware(app)

# Development hack for OAuth over HTTP
if os.getenv("OAUTHLIB_INSECURE_TRANSPORT") == "1":
    os.environ['OAUTHLIB_INSECURE_TRANSPORT'] = '1'

if os.getenv("OAUTHLIB_RELAX_TOKEN_SCOPE") == "1":
    os.environ['OAUTHLIB_RELAX_TOKEN_SCOPE'] = '1'

# Database Configuration
basedir = os.path.abspath(os.path.dirname(__file__))
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + os.path.join(basedir, 'trades.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db.init_app(app)

# Global State
trading_active = False
last_traded_trend = None
pending_pullback = None
max_trades_today = 3  # default, overridden by /settings
num_lots_to_trade = 1 # Global lot size setting


# Initialize Database
with app.app_context():
    db.create_all()

@app.errorhandler(Exception)
def handle_exception(e):
    print(f"ERROR: {str(e)}")
    import traceback
    traceback.print_exc()
    return jsonify({"error": "Internal Server Error", "details": str(e)}), 500
    
@app.route("/")
def home():
    return jsonify({
        "message": "Nifty Bot API is LIVE 🚀",
        "endpoints": [
            "/data",
            "/start",
            "/stop",
            "/trades",
            "/export",
            "/settings"
        ]
    })


@app.route("/settings", methods=["POST", "OPTIONS"])
def set_settings():
    if request.method == "OPTIONS":
        return "", 200
        
    global max_trades_today, num_lots_to_trade
    data = request.get_json()
    if not data:
        return jsonify({"error": "Missing JSON body"}), 400
        
    max_trades_today = int(data.get("max_trades", 3))
    num_lots_to_trade = int(data.get("lots", 1))
    
    print(f"⚙️ Settings Updated: Max Trades = {max_trades_today}, Lots = {num_lots_to_trade}")
    return jsonify({
        "status": "ok", 
        "max_trades_today": max_trades_today,
        "num_lots": num_lots_to_trade
    })


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
    if get_active_trade_count() == 0:
        last_traded_trend = None
        pending_pullback = None

    oi = analyze_oi(atm)
    support = oi["support"]
    resistance = oi["resistance"]

    # Entry Logic (Only if system is RUNNING)
    if trading_active:        # 2.1 PRIORITIZE ACTIVE TRADE CHECK
        active_trades = get_active_trade_count()
        trade_count = get_trade_count_today()

        if active_trades >= 1:
            signal_to_return = "WAIT ⏳ (Trade Active)"
            # Skip new setup detection but still fetch data for chart/price
        else:
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
                    
                    # Check constraints before execution (Trend rule REMOVED)
                    if trade_count >= max_trades_today:
                        signal_to_return = f"BLOCKED 🚫 (Daily Limit {max_trades_today} Reached)"
                    else:
                        from execution.trade_tracker import check_entry
                        # Get user from session
                        user_email = session.get("user", {}).get("email", "System Auto")
                        check_entry(candidate_signal, *candidate_entry, trend=trend, lots=num_lots_to_trade, user_email=user_email)
                        last_traded_trend = trend
                        signal_to_return = f"✅ AUTO EXECUTED ({trade_count + 1}/{max_trades_today}): {candidate_signal}"
                                
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
                            # 🚫 Daily Limit Check
                            if trade_count >= max_trades_today:
                                signal_to_return = f"BLOCKED 🚫 (Daily Limit {max_trades_today} Reached)"
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
        "max_trades_today": max_trades_today,
        "trade_count_today": get_trade_count_today(),
        "active_trade": active_trade_data,
        "report": report,
        "chart_data": chart_df[['time', 'open', 'high', 'low', 'close', 'ema20', 'ema50']].to_dict(orient="records"),
        "interval": interval
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
    global trading_active, last_traded_trend, pending_pullback
    trading_active = True
    last_traded_trend = None
    pending_pullback = None
    print("▶️ Engine Status: RUNNING (State Reset)")
    return jsonify({"status": "RUNNING", "trading_active": True})


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





if __name__ == "__main__":
    app.run(debug=True, port=5000)