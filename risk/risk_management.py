def calculate_position(capital, option_price):

    risk = capital * 0.02
    quantity = int(risk / option_price)

    return quantity