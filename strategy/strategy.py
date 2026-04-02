def generate_signal(df):

    latest = df.iloc[-1]

    close = latest["Close"]
    ema9 = latest["EMA9"]
    ema21 = latest["EMA21"]
    rsi = latest["RSI"]
    macd = latest["MACD"]
    macd_signal = latest["MACD_SIGNAL"]

    if (
        close > ema9
        and ema9 > ema21
        and rsi > 60
        and macd > macd_signal
    ):
        return "BUY CALL"

    if (
        close < ema9
        and ema9 < ema21
        and rsi < 40
        and macd < macd_signal
    ):
        return "BUY PUT"

    return "NO TRADE"