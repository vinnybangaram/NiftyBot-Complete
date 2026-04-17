import yfinance as yf
import pandas as pd

def get_nifty_data(interval="5m"):
    df = yf.download(
        "^NSEI",
        interval=interval,
        period="5d",
        auto_adjust=True,
        progress=False
    )

    # Fix MultiIndex columns from yfinance
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = df.columns.get_level_values(0)

    df = df.dropna()

    return df