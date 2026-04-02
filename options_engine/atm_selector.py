import yfinance as yf


def get_current_nifty_price():

    data = yf.download("^NSEI", period="1d", interval="1m", progress=False)

    return float(data["Close"].iloc[-1])


def get_atm_strike(nifty_price):

    strike_interval = 50

    atm = round(nifty_price / strike_interval) * strike_interval

    return int(atm)