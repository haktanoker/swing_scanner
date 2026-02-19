import sys
sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")
import time
from app.services.scheduler import should_run_hourly
import threading
import traceback
from typing import List
from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.services.binance import (
    get_futures_symbols,
    get_futures_market_data,
    PROGRESS,
)
LAST_RUN_HOUR = None
# ======================================================
# APP
# ======================================================

app = FastAPI(
    title="Swing Scanner API",
    version="1.1.0",
)

# ======================================================
# CORS
# ======================================================

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

# ======================================================
# MARKET CACHE
# ======================================================

MARKET_CACHE = {
    "data": None,
    "last_update": None,
    "updating": False,
}

# ======================================================
# MARKET UPDATE (BACKGROUND THREAD)
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

        MARKET_CACHE["data"] = data
        MARKET_CACHE["last_update"] = datetime.now(timezone.utc).isoformat()

        print("[MARKET] update finished")

    except Exception:
        traceback.print_exc()

    finally:
        MARKET_CACHE["updating"] = False
        PROGRESS["running"] = False

# ======================================================
# MARKET SCHEDULER
# ======================================================

def market_scheduler():
    global LAST_RUN_HOUR

    print("[SCHEDULER] hourly scheduler started")

    # 🔥 İLK AÇILIŞTA HEMEN ÇALIŞ
    try:
        print("[SCHEDULER] initial market update")
        run_market_update()
        LAST_RUN_HOUR = datetime.now(timezone.utc).strftime("%Y-%m-%d %H")
    except Exception:
        traceback.print_exc()

    while True:
        try:
            now = datetime.now(timezone.utc)

            if should_run_hourly(now):
                hour_key = now.strftime("%Y-%m-%d %H")

                if LAST_RUN_HOUR != hour_key:
                    if not MARKET_CACHE["updating"]:
                        print(f"[SCHEDULER] market update triggered at {hour_key}:05")
                        LAST_RUN_HOUR = hour_key
                        run_market_update()
                    else:
                        print("[SCHEDULER] update already running, skipped")

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
    return {
        "status": "healthy",
        "time": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/symbols")
def symbols():
    syms: List[str] = get_futures_symbols()
    return {"count": len(syms), "symbols": syms}


@app.get("/market")
def market():
    if MARKET_CACHE["data"] is None:
        return {
            "ready": False,
            "data": [],
            "last_update": None,
        }

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

@app.on_event("startup")
def start_scheduler():
    thread = threading.Thread(
        target=market_scheduler,
        daemon=True
    )
    thread.start()