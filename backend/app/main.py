import sys
sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")

import time
import threading
import traceback
import json
from typing import List
from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.services.binance import (
    get_futures_symbols,
    get_futures_market_data,
    save_market_cache,
    load_market_cache,
    PROGRESS,
)
from app.services.telegram import (
    check_and_notify,
    load_telegram_settings,
    save_telegram_settings,
)

LAST_RUN_SLOT = None  # "2024-01-01 14:00" veya "14:30" gibi 30 dakikalık slot

app = FastAPI(title="Swing Scanner API", version="1.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://swing.haktanoker.com",
        "https://myapps.haktanoker.com",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MARKET_CACHE = {
    "data": None,
    "last_update": None,
    "updating": False,
}

# ======================================================
# AÇILIŞTA DOSYADAN YÜKLE
# ======================================================
def load_cache_on_startup():
    cached = load_market_cache()
    if cached and cached.get("data"):
        MARKET_CACHE["data"] = cached["data"]
        MARKET_CACHE["last_update"] = cached["last_update"]
        print(f"[CACHE] loaded {len(cached['data'])} coins from file")
    else:
        print("[CACHE] no cache file found, will fetch fresh")

# ======================================================
# MARKET UPDATE
# ======================================================
def run_market_update():
    if MARKET_CACHE["updating"]:
        return
    try:
        print("[MARKET] update started")
        MARKET_CACHE["updating"] = True
        PROGRESS["running"] = True
        PROGRESS["done"] = 0
        symbols = get_futures_symbols()
        PROGRESS["total"] = len(symbols)
        PROGRESS["started_at"] = datetime.now(timezone.utc).isoformat()

        data = get_futures_market_data()
        now = datetime.now(timezone.utc).isoformat()

        MARKET_CACHE["data"] = data
        MARKET_CACHE["last_update"] = now

        # 🔥 Dosyaya kaydet
        save_market_cache(data, now)

        # 🔥 Telegram bildirim
        try:
            check_and_notify(data)
        except Exception:
            traceback.print_exc()

        print("[MARKET] update finished")
    except Exception:
        traceback.print_exc()
    finally:
        MARKET_CACHE["updating"] = False
        PROGRESS["running"] = False

# ======================================================
# 30 DAKİKALIK SCHEDULER
# ======================================================
def is_daytime(now: datetime) -> bool:
    """07:00 - 23:00 UTC+3 (Türkiye saati)"""
    turkey_hour = (now.hour + 3) % 24
    return 7 <= turkey_hour < 23

def get_slot(now: datetime) -> str:
    """Gündüz: 30 dakikalık slot | Gece: saatlik slot"""
    if is_daytime(now):
        slot_min = 0 if now.minute < 30 else 30
        return now.strftime(f"%Y-%m-%d %H:") + f"{slot_min:02d}"
    else:
        return now.strftime("%Y-%m-%d %H:00")

def market_scheduler():
    global LAST_RUN_SLOT
    print("[SCHEDULER] scheduler started")

    load_cache_on_startup()

    print("[SCHEDULER] startup fetch başlatılıyor...")
    run_market_update()
    LAST_RUN_SLOT = get_slot(datetime.now(timezone.utc))

    while True:
        try:
            now = datetime.now(timezone.utc)
            current_slot = get_slot(now)

            if is_daytime(now):
                slot_minute = now.minute % 30
                ready = slot_minute >= 2
            else:
                ready = now.minute >= 2

            if current_slot != LAST_RUN_SLOT and ready:
                if not MARKET_CACHE["updating"]:
                    print(f"[SCHEDULER] update triggered at slot {current_slot}")
                    LAST_RUN_SLOT = current_slot
                    run_market_update()
        except Exception:
            traceback.print_exc()
        time.sleep(30)

# ======================================================
# ROUTES
# ======================================================
@app.get("/")
def root():
    return {"status": "ok"}

@app.get("/health")
def health():
    return {"status": "healthy", "time": datetime.now(timezone.utc).isoformat()}

@app.get("/symbols")
def symbols():
    syms: List[str] = get_futures_symbols()
    return {"count": len(syms), "symbols": syms}

@app.get("/market")
def market():
    if MARKET_CACHE["data"] is None:
        return {"ready": False, "data": [], "last_update": None}
    return {
        "ready": True,
        "data": MARKET_CACHE["data"],
        "last_update": MARKET_CACHE["last_update"],
    }

@app.get("/progress")
def progress():
    percent = 0
    if PROGRESS["running"] and PROGRESS["total"] > 0:
        percent = round((PROGRESS["done"] / PROGRESS["total"]) * 100, 1)
    return {**PROGRESS, "percent": percent}

@app.post("/trigger-update")
def trigger_update():
    if MARKET_CACHE["updating"]:
        return {"status": "already_running"}
    thread = threading.Thread(target=run_market_update, daemon=True)
    thread.start()
    return {"status": "started"}

# ======================================================
# TELEGRAM ROUTES
# ======================================================
class TelegramSettingsBody(BaseModel):
    enabled: bool
    filters: dict

@app.get("/telegram/settings")
def get_telegram_settings():
    return load_telegram_settings()

@app.post("/telegram/settings")
def post_telegram_settings(body: TelegramSettingsBody):
    save_telegram_settings({"enabled": body.enabled, "filters": body.filters})
    
    # 🔥 Kayıt sonrası hemen tara ve gönder
    if body.enabled and MARKET_CACHE["data"]:
        def notify_async():
            try:
                check_and_notify(MARKET_CACHE["data"])
            except Exception:
                traceback.print_exc()
        thread = threading.Thread(target=notify_async, daemon=True)
        thread.start()
    
    return {"status": "saved"}

@app.post("/telegram/test")
def test_telegram():
    from app.services.telegram import send_telegram_message
    ok = send_telegram_message("✅ <b>Swing Scanner</b> – Test mesajı başarılı!")
    return {"status": "ok" if ok else "failed"}

# ======================================================
# STARTUP
# ======================================================
@app.on_event("startup")
def start_scheduler():
    thread = threading.Thread(target=market_scheduler, daemon=True)
    thread.start()