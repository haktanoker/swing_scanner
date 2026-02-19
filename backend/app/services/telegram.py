import requests
import json
from app.services.filter_engine import apply_filters_python

TELEGRAM_BOT_TOKEN = "8759712815:AAG2uXSJzYYX92_TMekl9HZpdE_b9pjhC8g"
TELEGRAM_CHAT_ID = "-1003852077517"
TELEGRAM_SETTINGS_FILE = "telegram_settings.json"

def load_telegram_settings() -> dict:
    try:
        with open(TELEGRAM_SETTINGS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {"enabled": False, "filters": {}}

def save_telegram_settings(settings: dict):
    with open(TELEGRAM_SETTINGS_FILE, "w", encoding="utf-8") as f:
        json.dump(settings, f, ensure_ascii=False, indent=2)

def send_telegram_message(text: str):
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    payload = {
        "chat_id": TELEGRAM_CHAT_ID,
        "text": text,
        "parse_mode": "HTML",
    }
    try:
        resp = requests.post(url, json=payload, timeout=10)
        resp.raise_for_status()
        return True
    except Exception as e:
        print(f"[TELEGRAM] send failed: {e}")
        return False

def format_coin_message(coin: dict) -> str:
    ha_map = {
        "green": "🟢",
        "red": "🔴",
        "red_to_green": "🔴→🟢",
        "green_to_red": "🟢→🔴",
    }

    symbol = coin["symbol"].replace("USDT", "")
    price = coin.get("price", 0)
    change = coin.get("change24h", 0)
    funding = coin.get("funding")
    ratio = coin.get("circulating_ratio")

    rsi_1h = coin.get("rsi_1h")
    rsi_4h = coin.get("rsi_4h")
    rsi_1d = coin.get("rsi_1d")

    k_1h = coin.get("stoch_k_1h")
    k_4h = coin.get("stoch_k_4h")
    k_1d = coin.get("stoch_k_1d")

    ha_1h = ha_map.get(coin.get("ha_1h", ""), "—")
    ha_4h = ha_map.get(coin.get("ha_4h", ""), "—")
    ha_1d = ha_map.get(coin.get("ha_1d", ""), "—")

    # Fiyat formatı
    if price >= 1:
        price_str = f"${price:,.2f}"
    elif price > 0:
        decimals = min(8, max(2, -int(__import__('math').log10(price)) + 2))
        price_str = f"${price:.{decimals}f}"
    else:
        price_str = "$0"

    # Değişim
    change_str = f"%{change:+.2f}"

    # Funding
    funding_str = f"{funding * 100:.4f}%" if funding is not None else "—"

    # Arz
    ratio_str = f"%{round(ratio)}" if ratio is not None else "—"

    # RSI
    rsi_1h_str = str(round(rsi_1h)) if rsi_1h is not None else "—"
    rsi_4h_str = str(round(rsi_4h)) if rsi_4h is not None else "—"
    rsi_1d_str = str(round(rsi_1d)) if rsi_1d is not None else "—"

    # Stoch
    k_1h_str = str(round(k_1h)) if k_1h is not None else "—"
    k_4h_str = str(round(k_4h)) if k_4h is not None else "—"
    k_1d_str = str(round(k_1d)) if k_1d is not None else "—"

    return (
        f"<b>{symbol}</b> | {price_str} | {change_str}\n"
        f"Funding {funding_str} | Arz {ratio_str}\n"
        f"RSI: 1h.{rsi_1h_str} | 4h.{rsi_4h_str} | 1d.{rsi_1d_str}\n"
        f"SRSI: 1h.{k_1h_str} | 4h.{k_4h_str} | 1d.{k_1d_str}\n"
        f"Heikin: 1h.{ha_1h} | 4h.{ha_4h} | 1d.{ha_1d}"
    )

def check_and_notify(market_data: list):
    settings = load_telegram_settings()
    if not settings.get("enabled"):
        return

    filters = settings.get("filters", {})
    if not filters:
        return

    matched = []
    for coin in market_data:
        result = apply_filters_python(coin, filters)
        if result.get("excluded"):
            continue
        passed = result.get("passed", 0)
        total = result.get("total", 0)
        if total > 0 and passed == total:
            matched.append(coin)

    if not matched:
        print(f"[TELEGRAM] no matching coins, skipping")
        return

    print(f"[TELEGRAM] sending {len(matched)} coins one by one")

    for coin in matched:
        msg = format_coin_message(coin)
        send_telegram_message(msg)
        import time
        time.sleep(0.3)  # Telegram rate limit için küçük bekleme