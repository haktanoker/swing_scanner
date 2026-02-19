import requests
import time
import re
import json
from pathlib import Path
from typing import List, Dict

# ======================================================
# CONFIG
# ======================================================

CMC_API_KEY = "f48a256165c744e6b235f832aeb9845b"
CMC_BASE_URL = "https://pro-api.coinmarketcap.com/v2/cryptocurrency/quotes/latest"

BLACKLIST_PATH = Path("data/cmc_blacklist.json")

# ======================================================
# BLACKLIST HELPERS
# ======================================================

def load_blacklist() -> set[str]:
    if not BLACKLIST_PATH.exists():
        return set()
    with open(BLACKLIST_PATH, "r", encoding="utf-8") as f:
        return set(json.load(f))


def save_blacklist(bl: set[str]):
    BLACKLIST_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(BLACKLIST_PATH, "w", encoding="utf-8") as f:
        json.dump(sorted(bl), f, indent=2)


# ======================================================
# SYMBOL PREFILTER
# ======================================================

LATIN_RE = re.compile(r"^[A-Z]+$")


def is_valid_symbol(sym: str) -> bool:
    """
    Baştan elenecekler:
    - boş
    - 2 harften kısa
    - A-Z dışı karakter
    """
    if not sym:
        return False
    if len(sym) < 2:
        return False
    if not LATIN_RE.match(sym):
        return False
    return True


def prefilter_symbols(symbols: List[str]) -> List[str]:
    return [s for s in symbols if is_valid_symbol(s)]


# ======================================================
# LOW LEVEL FETCH
# ======================================================

def _fetch_chunk_raw(symbols: List[str]) -> Dict:
    headers = {
        "X-CMC_PRO_API_KEY": CMC_API_KEY
    }
    params = {
        "symbol": ",".join(symbols),
        "convert": "USD"
    }

    resp = requests.get(CMC_BASE_URL, headers=headers, params=params, timeout=30)
    resp.raise_for_status()
    return resp.json().get("data", {})


def parse_cmc_entry(raw):
    entry = raw[0] if isinstance(raw, list) else raw

    max_supply = entry.get("max_supply")
    circulating = entry.get("circulating_supply")

    ratio = None
    if max_supply and circulating:
        ratio = (circulating / max_supply) * 100

    return {
        "max": max_supply,
        "circulating": circulating,
        "ratio": ratio
    }


# ======================================================
# SMART + PERSISTENT FETCH
# ======================================================

def fetch_cmc_supply_smart(
    symbols: List[str],
    blacklist: set[str],
) -> Dict[str, Dict]:
    """
    - Chunk çalışırsa direkt alır
    - Çalışmazsa:
        - 2'ye böler
        - her tarafı ayrı dener
    - En sonda hâlâ çalışmayan coin(ler) blacklist'e yazılır
    """

    result: Dict[str, Dict] = {}

    if not symbols:
        return result

    # Blacklist'tekileri baştan pas geç
    symbols = [s for s in symbols if s not in blacklist]
    if not symbols:
        return result

    try:
        data = _fetch_chunk_raw(symbols)

        for sym in symbols:
            raw = data.get(sym)
            if raw:
                result[sym] = parse_cmc_entry(raw)
            else:
                result[sym] = {"max": None, "circulating": None, "ratio": None}

        return result

    except Exception:
        # 🔥 Chunk patladı → küçült
        if len(symbols) <= 3:
            # Artık tek tek dene
            for sym in symbols:
                try:
                    data = _fetch_chunk_raw([sym])
                    raw = data.get(sym)
                    if raw:
                        result[sym] = parse_cmc_entry(raw)
                    else:
                        result[sym] = {"max": None, "circulating": None, "ratio": None}
                except Exception:
                    # 🔥 Bu coin CMC'de kesin sorunlu
                    blacklist.add(sym)
                    result[sym] = {"max": None, "circulating": None, "ratio": None}
            return result

        # Daha büyükse ikiye böl
        mid = len(symbols) // 2
        left = symbols[:mid]
        right = symbols[mid:]

        # print("[CMC] chunk error, split")


        time.sleep(1)

        result.update(fetch_cmc_supply_smart(left, blacklist))
        result.update(fetch_cmc_supply_smart(right, blacklist))

        return result


# ======================================================
# PUBLIC ENTRY POINT
# ======================================================

def fetch_cmc_supply_batched(
    bases: List[str],
    chunk_size: int = 80,
    sleep_sec: int = 2
):
    """
    - Prefilter
    - Blacklist uygula
    - Smart recursive fetch
    - Blacklist'i kalıcı kaydet
    """

    out: Dict[str, Dict] = {}

    blacklist = load_blacklist()

    # 1️⃣ Prefilter
    clean = prefilter_symbols(bases)
    skipped_prefilter = sorted(set(bases) - set(clean))

    if skipped_prefilter:
        pass
        # print("[CMC] skipped by prefilter")

    # 2️⃣ Blacklist uygula
    clean = [s for s in clean if s not in blacklist]

    # 3️⃣ Chunk chunk işle
    for i in range(0, len(clean), chunk_size):
        chunk = clean[i:i + chunk_size]
        data = fetch_cmc_supply_smart(chunk, blacklist)
        out.update(data)
        time.sleep(sleep_sec)

    # 4️⃣ Baştan elenenler
    for sym in skipped_prefilter:
        out[sym] = {"max": None, "circulating": None, "ratio": None}

    # 5️⃣ Blacklist'i diske yaz
    save_blacklist(blacklist)

    if blacklist:
        pass

    return out
