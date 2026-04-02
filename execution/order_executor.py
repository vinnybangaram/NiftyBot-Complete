from kiteconnect import KiteConnect

api_key = "YOUR_API_KEY"
access_token = "YOUR_ACCESS_TOKEN"

kite = KiteConnect(api_key=api_key)
kite.set_access_token(access_token)

def place_order(symbol, quantity):

    kite.place_order(
        exchange="NFO",
        tradingsymbol=symbol,
        transaction_type="BUY",
        quantity=quantity,
        order_type="MARKET",
        product="MIS",
        variety="regular"
    )