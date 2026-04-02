import ta
import pandas as pd

def add_indicators(df):

    # ensure close column is 1D
    close = df["Close"].squeeze()

    df["EMA9"] = ta.trend.ema_indicator(close, window=9)
    df["EMA21"] = ta.trend.ema_indicator(close, window=21)

    df["RSI"] = ta.momentum.rsi(close, window=14)

    macd = ta.trend.MACD(close)

    df["MACD"] = macd.macd()
    df["MACD_SIGNAL"] = macd.macd_signal()

    df["EMA20"] = df["Close"].ewm(span=20).mean()
    df["EMA50"] = df["Close"].ewm(span=50).mean()

    return df