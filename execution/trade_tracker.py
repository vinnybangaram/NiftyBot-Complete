from models import db, Trade
from datetime import datetime, timedelta, timezone
import pandas as pd
import uuid
from twilio.rest import Client


import config

COOLDOWN_SECONDS = 180
MIN_MOVE = 40
MIN_TREND_STRENGTH = 25


# =========================
# ✅ FILTERS & VALIDATION
# =========================
def validate_trade(df, signal, entry, sl, target):
    """
    Professional Grade Trade Guard
    Returns (valid: bool, reason: str)
    """
    latest = df.iloc[-1]
    nifty_price = latest["Close"]
    
    # 1️⃣ Expected Move Filter (Reward)
    expected_move = abs(target - entry)
    if expected_move < MIN_MOVE:
        return False, f"Low Reward ({expected_move:.1f} pts < {MIN_MOVE})"

    # 2️⃣ Trend Strength Filter
    # Look back 10 candles (50 mins on 5m chart)
    if len(df) >= 10:
        trend_strength = abs(df["Close"].iloc[-1] - df["Close"].iloc[-10])
        if trend_strength < MIN_TREND_STRENGTH:
            return False, f"No Strong Trend ({trend_strength:.1f} pts < {MIN_TREND_STRENGTH})"
    
    # 3️⃣ EMA-20 Alignment
    ema20 = latest["EMA20"]
    if "CALL" in signal and nifty_price < ema20:
        return False, "Price below EMA-20 (No Call)"
    if "PUT" in signal and nifty_price > ema20:
        return False, "Price above EMA-20 (No Put)"

    # 4️⃣ Candle Strength Check
    candle_body = abs(latest["Close"] - latest["Open"])
    candle_range = latest["High"] - latest["Low"]
    if candle_range > 0:
        strength_pct = (candle_body / candle_range) * 100
        if strength_pct < 70:
            return False, f"Weak Candle ({strength_pct:.1f}% Body < 70%)"

    # 5️⃣ Cooldown Check (180s)
    last_trade = Trade.query.order_by(Trade.entry_time.desc()).first()
    if last_trade:
        # DB stores time in UTC
        now_utc = datetime.now(timezone.utc).replace(tzinfo=None) # Keep naive for DB comparison if needed, or handle correctly
        time_since_last = (datetime.now(timezone.utc).replace(tzinfo=None) - last_trade.entry_time.replace(tzinfo=None)).total_seconds()
        if time_since_last < COOLDOWN_SECONDS:
            return False, f"Cooldown active ({int(COOLDOWN_SECONDS - time_since_last)}s left)"

    return True, "QUALIFIED_TRADE"


def get_trade_count_today():
    """Returns number of trades executed today"""
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0, tzinfo=None)
    count = Trade.query.filter(Trade.entry_time >= today_start).count()
    return count

def get_active_trade_count():
    """Returns number of currently open trades"""
    return Trade.query.filter_by(status="OPEN").count()

def send_whatsapp_message(msg):
    """Sends a WhatsApp alert via Twilio"""
    account_sid = "YOUR_SID"
    auth_token = "YOUR_TOKEN"
    try:
        client = Client(account_sid, auth_token)
        client.messages.create(
            body=msg,
            from_='whatsapp:+14155238886',  # Twilio sandbox
            to='whatsapp:+91XXXXXXXXXX'   # Replace with your number
        )
        print("📲 WhatsApp Alert Sent Successfully")
    except Exception as e:
        print(f"❌ WhatsApp Alert Failed: {e}")

def check_entry(signal, entry_price, sl, target, trend="N/A"):

    # ✅ Detect trade type
    if "CALL" in signal:
        trade_type = "CALL"

    elif "PUT" in signal:
        trade_type = "PUT"

    else:
        return

    new_trade = Trade(
        type=trade_type,
        signal=signal,
        entry_price=float(entry_price),
        sl=float(sl),
        target=float(target),
        status="OPEN",
        entry_time=datetime.utcnow()
    )

    db.session.add(new_trade)
    db.session.commit()

    print(f"✅ Multi-Trade Entered: {trade_type} @ {entry_price}")

    # 📲 WhatsApp Alert (Pro Upgrade)
    msg = f"""
🚀 NIFTY TRADE SIGNAL

Signal: {signal}
Entry: {entry_price}
SL: {sl}
Target: {target}

Confidence: HIGH 🔥
Trend: {trend}
"""
    send_whatsapp_message(msg)


# =========================
# ✅ EXIT LOGIC (FOR ALL OPEN TRADES)
# =========================
def check_exit(current_price):

    active_trades = Trade.query.filter_by(status="OPEN").all()

    if not active_trades:
        return

    current_price = float(current_price)

    for trade in active_trades:

        entry = trade.entry_price
        trade_type = trade.type
        sl = trade.sl
        target = trade.target

        # =========================
        # 🚀 CALL
        # =========================
        if trade_type == "CALL":
            
            pnl_modifier = getattr(trade, 'active_multiplier', 1.0)
            realized = getattr(trade, 'realized_partial_pnl', 0.0)

            # 🎯 PARTIAL PROFIT (+30 pts)
            if not getattr(trade, 'partial_booked', False) and (current_price - entry) >= 30:
                trade.partial_booked = True
                trade.realized_partial_pnl = round(30 * config.LOT_SIZE * 0.5, 2)
                trade.active_multiplier = 0.5
                trade.sl = entry
                trade.trailing_sl = current_price - 20
                print(f"💰 CALL Partial Profit Booked. SL moved to {trade.sl}. TSL matches.")

            # Update Trailing SL if partial booked
            if getattr(trade, 'partial_booked', False):
                new_sl = max(trade.trailing_sl or trade.sl, current_price - 20)
                trade.trailing_sl = new_sl

            # 🎯 TARGET
            if current_price >= target:
                pnl = (current_price - entry) * config.LOT_SIZE * pnl_modifier + realized
                trade.exit_price = current_price
                trade.pnl = round(pnl, 2)
                trade.status = "TARGET HIT"
                trade.exit_time = datetime.utcnow()
                print(f"🎯 CALL Target Hit (ID: {trade.id}): {pnl}")

            # 🛑 SL / Trailing SL
            elif current_price <= (trade.trailing_sl if getattr(trade, 'partial_booked', False) else trade.sl):
                pnl = (current_price - entry) * config.LOT_SIZE * pnl_modifier + realized
                trade.exit_price = current_price
                trade.pnl = round(pnl, 2)
                trade.status = "SL HIT" if not getattr(trade, 'partial_booked', False) else "TSL HIT"
                trade.exit_time = datetime.utcnow()
                print(f"🛑 CALL SL/TSL Hit (ID: {trade.id}): {pnl}")

        # =========================
        # 🔻 PUT
        # =========================
        elif trade_type == "PUT":
            
            pnl_modifier = getattr(trade, 'active_multiplier', 1.0)
            realized = getattr(trade, 'realized_partial_pnl', 0.0)

            # 🎯 PARTIAL PROFIT (+30 pts)
            if not getattr(trade, 'partial_booked', False) and (entry - current_price) >= 30:
                trade.partial_booked = True
                trade.realized_partial_pnl = round(30 * config.LOT_SIZE * 0.5, 2)
                trade.active_multiplier = 0.5
                trade.sl = entry
                trade.trailing_sl = current_price + 20
                print(f"💰 PUT Partial Profit Booked. SL moved to {trade.sl}. TSL matches.")

            # Update Trailing SL if partial booked
            if getattr(trade, 'partial_booked', False):
                new_sl = min(trade.trailing_sl or trade.sl, current_price + 20)
                trade.trailing_sl = new_sl

            # 🎯 TARGET
            if current_price <= target:
                pnl = (entry - current_price) * config.LOT_SIZE * pnl_modifier + realized
                trade.exit_price = current_price
                trade.pnl = round(pnl, 2)
                trade.status = "TARGET HIT"
                trade.exit_time = datetime.utcnow()
                print(f"🎯 PUT Target Hit (ID: {trade.id}): {pnl}")

            # 🛑 SL / Trailing SL
            elif current_price >= (trade.trailing_sl if getattr(trade, 'partial_booked', False) else trade.sl):
                pnl = (entry - current_price) * config.LOT_SIZE * pnl_modifier + realized
                trade.exit_price = current_price
                trade.pnl = round(pnl, 2)
                trade.status = "SL HIT" if not getattr(trade, 'partial_booked', False) else "TSL HIT"
                trade.exit_time = datetime.utcnow()
                print(f"🛑 PUT SL/TSL Hit (ID: {trade.id}): {pnl}")

    db.session.commit()


# =========================
# 🛑 MANUAL EXIT ALL
# =========================
def manual_exit_all_trades(current_price):

    current_price = float(current_price)
    open_trades = Trade.query.filter_by(status="OPEN").all()

    if not open_trades:
        return 0

    count = len(open_trades)

    for trade in open_trades:
        if trade.type == "CALL":
            pnl = (current_price - trade.entry_price) * config.LOT_SIZE
        else:
            pnl = (trade.entry_price - current_price) * config.LOT_SIZE

        trade.exit_price = current_price
        trade.pnl = round(pnl, 2)
        trade.status = "MANUAL EXIT"
        trade.exit_time = datetime.now(timezone.utc)

    db.session.commit()
    print(f"🛑 Manual Exit performed for {count} trades.")
    return count


# =========================
# 📊 REPORT (LIVE + CLOSED)
# =========================
def end_of_day_report(current_price=None, filter_date=None):
    query = Trade.query
    if filter_date:
        try:
            target_date = datetime.strptime(filter_date, '%Y-%m-%d').date()
            query = query.filter(db.func.date(Trade.entry_time) == target_date)
        except: pass
        
    all_trades = query.order_by(Trade.entry_time.desc()).all()
    report_fields = []
    total_pnl = 0

    for trade in all_trades:

        trade_dict = trade.to_dict()

        # Update P&L for open trades
        if trade.status == "OPEN" and current_price is not None:
            pnl_modifier = getattr(trade, 'active_multiplier', 1.0)
            realized = getattr(trade, 'realized_partial_pnl', 0.0)
            if trade.type == "CALL":
                pnl = (current_price - trade.entry_price) * config.LOT_SIZE * pnl_modifier + realized
            else:
                pnl = (trade.entry_price - current_price) * config.LOT_SIZE * pnl_modifier + realized
            trade_dict["pnl"] = round(pnl, 2)

        total_pnl += trade_dict["pnl"]
        report_fields.append(trade_dict)

    return {
        "total_trades": len(report_fields),
        "total_pnl": round(total_pnl, 2),
        "trades": report_fields,
        "active_count": len([t for t in report_fields if t["status"] == "OPEN"])
    }


# =========================
# 📊 EXPORT TO EXCEL
# =========================
def export_to_excel():
    all_trades = Trade.query.order_by(Trade.entry_time.desc()).all()
    if not all_trades:
        return "No trades to export"

    data = [t.to_dict() for t in all_trades]
    df = pd.DataFrame(data)

    total_trades = len(df)
    total_pnl = df["pnl"].sum()
    winning_trades = len(df[df["pnl"] > 0])
    losing_trades = len(df[df["pnl"] <= 0])
    win_rate = round((winning_trades / total_trades) * 100, 2) if total_trades > 0 else 0

    filename = f"trade_report_{datetime.now().strftime('%Y-%m-%d_%H%M')}.xlsx"

    with pd.ExcelWriter(filename, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="Trades")
        summary = pd.DataFrame({
            "Metric": ["Total Trades", "Total P&L", "Winning Trades", "Losing Trades", "Win Rate %", "Export Date"],
            "Value": [total_trades, round(total_pnl, 2), winning_trades, losing_trades, f"{win_rate}%", datetime.now().strftime('%Y-%m-%d %H:%M')]
        })
        summary.to_excel(writer, index=False, sheet_name="Summary")

    return filename

def export_filtered_to_excel(trades, date_str=None):
    if not trades:
        return "No trades to export"

    data = [t.to_dict() for t in trades]
    df = pd.DataFrame(data)

    total_trades = len(df)
    total_pnl = df["pnl"].sum()
    winning_trades = len(df[df["pnl"] > 0])
    losing_trades = len(df[df["pnl"] <= 0])
    win_rate = round((winning_trades / total_trades) * 100, 2) if total_trades > 0 else 0

    suffix = f"_{date_str}" if date_str else ""
    filename = f"trade_report{suffix}_{datetime.now().strftime('%H%M')}.xlsx"

    with pd.ExcelWriter(filename, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="Trades")
        summary = pd.DataFrame({
            "Metric": ["Filter Date", "Total Trades", "Total P&L", "Winning Trades", "Losing Trades", "Win Rate %", "Export Time"],
            "Value": [date_str or "All", total_trades, round(total_pnl, 2), winning_trades, losing_trades, f"{win_rate}%", datetime.now().strftime('%Y-%m-%d %H:%M')]
        })
        summary.to_excel(writer, index=False, sheet_name="Summary")

    return filename