import schedule
import time

from data.data_fetcher import get_nifty_data
from indicators.indicators import add_indicators
from strategy.strategy import generate_signal

from options_engine.atm_selector import get_atm_strike
from options_engine.oi_analysis import analyze_oi


def run_bot():

    print("\n------------------------------")

    df = get_nifty_data()

    df = add_indicators(df)

    signal = generate_signal(df)

    # latest price
    nifty_price = df["Close"].iloc[-1]

    atm = get_atm_strike(nifty_price)

    oi_levels = analyze_oi(atm)

    support = oi_levels["support"]
    resistance = oi_levels["resistance"]

    ce_change = oi_levels["ce_oi_change"]
    pe_change = oi_levels["pe_oi_change"]

    print("Signal:", signal)
    print("NIFTY Price:", round(nifty_price, 2))
    print("ATM Strike:", atm)

    print("OI Support:", support)
    print("OI Resistance:", resistance)

    print("CE OI Change:", ce_change)
    print("PE OI Change:", pe_change)
    print("PCR:", oi_levels["pcr"])
    print("Gamma Wall:", oi_levels["gamma_wall"])
    print("Call Wall:", oi_levels["call_wall"])
    print("Put Wall:", oi_levels["put_wall"])

    # OI BUILDUP DETECTION
    if ce_change > pe_change:
        print("📉 Short Buildup Detected (Bearish)")

    elif pe_change > ce_change:
        print("📈 Long Buildup Detected (Bullish)")

    # OPTION WRITER TRAP LOGIC
    if nifty_price > resistance:
        print("🚀 CALL WRITER TRAP → BUY CE")

    elif nifty_price < support:
        print("🔻 PUT WRITER TRAP → BUY PE")

    else:
        print("⏳ NO TRADE (Inside OI Range)")


if __name__ == "__main__":

    print("NIFTY Options Bot Started")

    run_bot()

    schedule.every(5).minutes.do(run_bot)

    while True:
        schedule.run_pending()
        time.sleep(1)

    