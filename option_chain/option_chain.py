import requests


def get_option_chain():

    url = "https://groww.in/v1/api/option_chain_service/v1/option_chain/nifty"

    headers = {
        "User-Agent": "Mozilla/5.0"
    }

    response = requests.get(url, headers=headers)

    data = response.json()

    # Correct structure
    if "optionChain" in data:
        return data["optionChain"]["optionChains"]

    raise Exception("Option chain data not found")