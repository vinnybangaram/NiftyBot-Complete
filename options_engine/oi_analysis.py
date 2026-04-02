from option_chain.option_chain import get_option_chain


def analyze_oi(atm_strike):

    option_chain = get_option_chain()

    call_oi = {}
    put_oi = {}
    combined_oi = {}

    ce_change = 0
    pe_change = 0

    total_ce_oi = 0
    total_pe_oi = 0

    for strike in option_chain:

        strike_price = strike["strikePrice"] / 100

        # only analyze strikes near ATM
        if abs(strike_price - atm_strike) > 500:
            continue

        ce = strike.get("callOption")
        pe = strike.get("putOption")

        ce_oi = 0
        pe_oi = 0

        # CALL DATA
        if ce:
            ce_oi = ce.get("openInterest", 0)

            call_oi[strike_price] = ce_oi
            total_ce_oi += ce_oi

            ce_change += ce_oi - ce.get("prevOpenInterest", 0)

        # PUT DATA
        if pe:
            pe_oi = pe.get("openInterest", 0)

            put_oi[strike_price] = pe_oi
            total_pe_oi += pe_oi

            pe_change += pe_oi - pe.get("prevOpenInterest", 0)

        # COMBINED OI (Gamma Wall logic)
        combined_oi[strike_price] = ce_oi + pe_oi

    # Safety check (avoid crash if empty)
    if not call_oi or not put_oi:
        return {
            "support": None,
            "resistance": None,
            "ce_oi_change": 0,
            "pe_oi_change": 0,
            "pcr": 0,
            "gamma_wall": None,
            "call_wall": None,
            "put_wall": None
        }

    # Core levels
    resistance = max(call_oi, key=call_oi.get)
    support = max(put_oi, key=put_oi.get)

    # PCR
    pcr = round(total_pe_oi / total_ce_oi, 2) if total_ce_oi != 0 else 0

    # Gamma Wall (max combined OI)
    gamma_wall = max(combined_oi, key=combined_oi.get)

    # OI Walls
    call_wall = max(call_oi, key=call_oi.get)
    put_wall = max(put_oi, key=put_oi.get)

    return {
        "support": support,
        "resistance": resistance,
        "ce_oi_change": ce_change,
        "pe_oi_change": pe_change,
        "pcr": pcr,
        "gamma_wall": gamma_wall,
        "call_wall": call_wall,
        "put_wall": put_wall
    }