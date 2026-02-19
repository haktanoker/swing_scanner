import requests
import pandas as pd
import time

from app.services.indicators import (
    calculate_rsi,
    calculate_sma,
    calculate_stoch_rsi,
    calculate_heikin_ashi_state,
)

# binance.py update_state ile artık konuşmuyor
# scheduler / main.py yönetecek
from app.services.cmc import fetch_cmc_supply_batched


BINANCE_FAPI_EXCHANGE_INFO = "https://fapi.binance.com/fapi/v1/exchangeInfo"
BINANCE_24H_TICKER = "https://fapi.binance.com/fapi/v1/ticker/24hr"
BINANCE_FUNDING_RATE = "https://fapi.binance.com/fapi/v1/premiumIndex"
BINANCE_KLINES = "https://fapi.binance.com/fapi/v1/klines"
DEV_LIMIT = None  # test için → prod'da None yap

# 🔥 Basit in-memory cache
RSI_CACHE = {}
RSI_CACHE_TS = {}

# 🔥 Progress durumu
PROGRESS = {
    "total": 0,
    "done": 0,
    "running": False,
    "started_at": None,
}

def crossed_up(series_a, series_b, lookback=3) -> bool:
    """
    Son lookback mum içinde A, B'nin altından üstüne geçti mi?
    """
    try:
        if series_a is None or series_b is None:
            return False
        if len(series_a) < lookback + 1 or len(series_b) < lookback + 1:
            return False

        for i in range(-lookback, 0):
            if (
                series_a.iloc[i - 1] < series_b.iloc[i - 1]
                and series_a.iloc[i] >= series_b.iloc[i]
            ):
                return True
        return False
    except Exception:
        return False

def crossed_down(series_a, series_b, lookback=3) -> bool:
    """
    Son lookback mum içinde A, B'nin üstünden altına geçti mi?
    """
    try:
        if series_a is None or series_b is None:
            return False
        if len(series_a) < lookback + 1 or len(series_b) < lookback + 1:
            return False

        for i in range(-lookback, 0):
            if (
                series_a.iloc[i - 1] > series_b.iloc[i - 1]
                and series_a.iloc[i] <= series_b.iloc[i]
            ):
                return True
        return False
    except Exception:
        return False

def get_futures_symbols():
    resp = requests.get(BINANCE_FAPI_EXCHANGE_INFO, timeout=20)
    resp.raise_for_status()
    data = resp.json()

    out = []
    for s in data.get("symbols", []):
        if s.get("status") != "TRADING":
            continue
        if s.get("contractType") != "PERPETUAL":
            continue

        sym = s.get("symbol", "")
        if not sym.endswith("USDT"):
            continue

        out.append(sym)

    return sorted(out)

def get_funding_rates():
    resp = requests.get(BINANCE_FUNDING_RATE, timeout=20)
    resp.raise_for_status()
    data = resp.json()

    funding_map = {}

    for item in data:
        symbol = item.get("symbol", "")
        if not symbol.endswith("USDT"):
            continue

        rate = item.get("lastFundingRate")
        if rate is None:
            continue

        funding_map[symbol] = float(rate)

    return funding_map

def get_futures_market_data():
    all_active_symbols = list(get_futures_symbols())

    if DEV_LIMIT:
        active_symbols = all_active_symbols[:DEV_LIMIT]
    else:
        active_symbols = all_active_symbols


    funding_map = get_funding_rates()

    # =========================
    # 🔥 CMC – BASE COIN LİSTESİ
    # =========================
    bases = list({sym.replace("USDT", "") for sym in active_symbols})

    # ✅ 80'lik chunk ile çek
    cmc_supply_map = {}
    CHUNK_SIZE = 80

    for i in range(0, len(bases), CHUNK_SIZE):
        chunk = bases[i : i + CHUNK_SIZE]

        try:
            part = fetch_cmc_supply_batched(chunk)
            if isinstance(part, dict):
                cmc_supply_map.update(part)

        except Exception as e:
            # print("[CMC] chunk skipped")
            pass

        time.sleep(1.2)


    resp = requests.get(BINANCE_24H_TICKER, timeout=20)
    resp.raise_for_status()
    data = resp.json()

    out = []

    for item in data:
        symbol = item.get("symbol", "")
        if symbol not in active_symbols:
            continue

        (
            rsi_1h,
            rsi_sma_1h,
            k_1h,
            d_1h,
            ha_1h,
            _is_new_1h,
            rsi_cross_up_1h,
            rsi_cross_down_1h,
            stoch_cross_up_1h,
            stoch_cross_down_1h,
        ) = fetch_indicators(symbol, "1h", 3600)

        (
            rsi_4h,
            rsi_sma_4h,
            k_4h,
            d_4h,
            ha_4h,
            _is_new_4h,
            rsi_cross_up_4h,
            rsi_cross_down_4h,
            stoch_cross_up_4h,
            stoch_cross_down_4h,
        ) = fetch_indicators(symbol, "4h", 14400)

        (
            rsi_1d,
            rsi_sma_1d,
            k_1d,
            d_1d,
            ha_1d,
            is_new_1d,
            rsi_cross_up_1d,
            rsi_cross_down_1d,
            stoch_cross_up_1d,
            stoch_cross_down_1d,
        ) = fetch_indicators(symbol, "1d", 86400)

        base = symbol.replace("USDT", "")
        supply = cmc_supply_map.get(base, {}) or {}

        out.append({
            "symbol": symbol,
            "price": float(item["lastPrice"]),
            "change24h": float(item["priceChangePercent"]),
            "volume": float(item["quoteVolume"]),
            "funding": funding_map.get(symbol, 0.0),

            # RSI
            "rsi_1h": rsi_1h,
            "rsi_4h": rsi_4h,
            "rsi_1d": rsi_1d,

            "rsi_sma_1h": rsi_sma_1h,
            "rsi_sma_4h": rsi_sma_4h,
            "rsi_sma_1d": rsi_sma_1d,

            # ✅ RSI CROSS (son 3 mum)
            "rsi_cross_up_1h_recent": bool(rsi_cross_up_1h),
            "rsi_cross_down_1h_recent": bool(rsi_cross_down_1h),
            "rsi_cross_up_4h_recent": bool(rsi_cross_up_4h),
            "rsi_cross_down_4h_recent": bool(rsi_cross_down_4h),
            "rsi_cross_up_1d_recent": bool(rsi_cross_up_1d),
            "rsi_cross_down_1d_recent": bool(rsi_cross_down_1d),

            # STOCH
            "stoch_k_1h": k_1h,
            "stoch_d_1h": d_1h,
            "stoch_k_4h": k_4h,
            "stoch_d_4h": d_4h,
            "stoch_k_1d": k_1d,
            "stoch_d_1d": d_1d,

            # ✅ STOCH CROSS (son 3 mum)
            "stoch_cross_up_1h_recent": bool(stoch_cross_up_1h),
            "stoch_cross_down_1h_recent": bool(stoch_cross_down_1h),
            "stoch_cross_up_4h_recent": bool(stoch_cross_up_4h),
            "stoch_cross_down_4h_recent": bool(stoch_cross_down_4h),
            "stoch_cross_up_1d_recent": bool(stoch_cross_up_1d),
            "stoch_cross_down_1d_recent": bool(stoch_cross_down_1d),

            # HEIKIN
            "ha_1h": ha_1h,
            "ha_4h": ha_4h,
            "ha_1d": ha_1d,

            # NEW COIN
            "is_new": is_new_1d,

            # 🔥 CMC SUPPLY
            "max_supply": supply.get("max"),
            "circulating_supply": supply.get("circulating"),
            "circulating_ratio": supply.get("ratio"),
        })

        PROGRESS["done"] += 1

    return out

def fetch_indicators(symbol: str, interval: str, ttl_seconds: int):
    now = time.time()
    cache_key = f"{symbol}_{interval}_indicators"

    if cache_key in RSI_CACHE:
        if now - RSI_CACHE_TS.get(cache_key, 0) < ttl_seconds:
            return RSI_CACHE[cache_key]

    params = {
        "symbol": symbol,
        "interval": interval,
        "limit": 60,
    }

    resp = requests.get(BINANCE_KLINES, params=params, timeout=20)
    if resp.status_code != 200:
        return (None, None, None, None, None, False, False, False, False, False)

    data = resp.json()
    if not data or len(data) < 3:
        return (None, None, None, None, None, False, False, False, False, False)

    df = pd.DataFrame(
        data,
        columns=[
            "open_time", "open", "high", "low", "close", "volume",
            "close_time", "quote_volume", "trades",
            "taker_base", "taker_quote", "ignore"
        ],
    )

    for col in ["open", "high", "low", "close"]:
        df[col] = df[col].astype(float)

    # RSI
    rsi_series = calculate_rsi(df["close"])
    rsi_val = rsi_series.iloc[-1] if len(rsi_series) else None

    # RSI SMA
    rsi_sma_series = calculate_sma(rsi_series, period=14)
    rsi_sma_val = rsi_sma_series.iloc[-1] if len(rsi_sma_series) else None

    # ✅ RSI CROSS (son 3 mum)
    rsi_cross_up_recent = crossed_up(rsi_series, rsi_sma_series, lookback=3)
    rsi_cross_down_recent = crossed_down(rsi_series, rsi_sma_series, lookback=3)

    # STOCH RSI (K/D)
    k_series, d_series = calculate_stoch_rsi(rsi_series)
    k_val = k_series.iloc[-1] if len(k_series) else None
    d_val = d_series.iloc[-1] if len(d_series) else None

    # ✅ STOCH CROSS (son 3 mum)
    stoch_cross_up_recent = crossed_up(k_series, d_series, lookback=3)
    stoch_cross_down_recent = crossed_down(k_series, d_series, lookback=3)

    # HEIKIN ASHI
    ha_state = calculate_heikin_ashi_state(df)

    # NEW COIN
    is_new_coin = interval == "1d" and len(df) <= 14

    result = (
        float(rsi_val) if rsi_val is not None and not pd.isna(rsi_val) else None,
        float(rsi_sma_val) if rsi_sma_val is not None and not pd.isna(rsi_sma_val) else None,
        float(k_val) if k_val is not None and not pd.isna(k_val) else None,
        float(d_val) if d_val is not None and not pd.isna(d_val) else None,
        ha_state,
        is_new_coin,
        bool(rsi_cross_up_recent),
        bool(rsi_cross_down_recent),
        bool(stoch_cross_up_recent),
        bool(stoch_cross_down_recent),
    )

    RSI_CACHE[cache_key] = result
    RSI_CACHE_TS[cache_key] = now

    return result
