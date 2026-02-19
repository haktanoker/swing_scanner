def apply_filters_python(coin: dict, filters: dict) -> dict:
    passed = 0
    total = 0
    details = {}

    # print(f"[FILTER DEBUG] {coin.get('symbol')} | filters: {filters}")

    # Yeni coin exclude
    if filters.get("new_coin_exclude") and coin.get("is_new"):
        return {"passed": 0, "total": 0, "details": {}, "excluded": True}

    # Max supply
    if filters.get("max_supply_only"):
        total += 1
        min_ratio = filters.get("min_circulating_ratio")
        ratio = coin.get("circulating_ratio")
        ok = False
        if ratio is not None:
            ok = (min_ratio is None) or (ratio >= min_ratio)
        details["MAX_SUPPLY|global"] = ok
        if ok:
            passed += 1

    for tf in ["1h", "4h", "1d"]:
        # RSI
        rsi_filter = filters.get(f"rsi_{tf}")
        if rsi_filter and isinstance(rsi_filter, dict):
            rsi_val = coin.get(f"rsi_{tf}")

            # 🔥 hem 'min'/'max' hem de eski 'gt'/'lt' anahtarlarını destekle
            mn = rsi_filter.get("min") if rsi_filter.get("min") is not None else rsi_filter.get("gt")
            mx = rsi_filter.get("max") if rsi_filter.get("max") is not None else rsi_filter.get("lt")

            if mn is not None or mx is not None:
                total += 1
                ok = False
                if rsi_val is not None:
                    ok = (mn is None or rsi_val >= mn) and (mx is None or rsi_val <= mx)
                details[f"RSI_RANGE|{tf}"] = ok
                if ok:
                    passed += 1

            if rsi_filter.get("cross_up"):
                total += 1
                ok = bool(coin.get(f"rsi_cross_up_{tf}_recent"))
                details[f"RSI_SMA_UP|{tf}"] = ok
                if ok:
                    passed += 1

            if rsi_filter.get("cross_down"):
                total += 1
                ok = bool(coin.get(f"rsi_cross_down_{tf}_recent"))
                details[f"RSI_SMA_DOWN|{tf}"] = ok
                if ok:
                    passed += 1

        # STOCH
        stoch_filter = filters.get(f"stoch_{tf}")
        if stoch_filter and isinstance(stoch_filter, dict):
            k_val = coin.get(f"stoch_k_{tf}")
            d_val = coin.get(f"stoch_d_{tf}")

            if stoch_filter.get("k_lt") is not None:
                total += 1
                ok = k_val is not None and k_val < stoch_filter["k_lt"]
                details[f"STOCH_RANGE|{tf}"] = ok
                if ok:
                    passed += 1

            if stoch_filter.get("k_gt_d"):
                total += 1
                ok = k_val is not None and d_val is not None and k_val > d_val
                details[f"STOCH_K_GT_D|{tf}"] = ok
                if ok:
                    passed += 1

            if stoch_filter.get("k_lt_d"):
                total += 1
                ok = k_val is not None and d_val is not None and k_val < d_val
                details[f"STOCH_K_LT_D|{tf}"] = ok
                if ok:
                    passed += 1

        # HEIKIN ASHI
        ha_filter = filters.get(f"ha_{tf}")
        if ha_filter:
            total += 1
            ha_val = coin.get(f"ha_{tf}")
            # 🔥 red_to_green ve green_to_red da eşleşsin
            if ha_filter == "green":
                ok = ha_val in ("green", "red_to_green")
            elif ha_filter == "red":
                ok = ha_val in ("red", "green_to_red")
            else:
                ok = ha_val == ha_filter
            details[f"HA|{tf}"] = ok
            if ok:
                passed += 1

    return {"passed": passed, "total": total, "details": details, "excluded": False}