"use client";

import { useEffect, useState } from "react";
import { fetchMarket } from "../lib/api";
import CoinTable from "../components/CoinTable";
import { applyFilters } from "../lib/filterEngine";
import { CoinRow } from "../types";
import FilterBar from "../components/FilterBar";
import FilterModal from "../components/FilterModal";
import TelegramModal from "../components/TelegramModal";

type FilterState = {
  rsi_1h?: { lt?: number; gt?: number };
  rsi_4h?: { lt?: number; gt?: number };
  rsi_1d?: { lt?: number; gt?: number };

  stoch_1h?: { k_lt?: number; k_gt_d?: boolean };
  stoch_4h?: { k_lt?: number; k_gt_d?: boolean };
  stoch_1d?: { k_lt?: number; k_gt_d?: boolean };

  ha_1h?: "green" | "red";
  ha_4h?: "green" | "red";
  ha_1d?: "green" | "red";

  funding?: { lt?: number; gt?: number };
  new_coin_exclude?: boolean;
};

type ScoredRow = CoinRow & {
  score: number;
  score_details?: Record<string, boolean>;
  __filters: FilterState;
};

const FILTER_STORAGE_KEY = "swing_scanner_filters";

function hasActiveFilters(filters: any) {
  return Object.values(filters).some((v) => {
    if (v == null) return false;
    if (typeof v === "boolean") return v;
    if (typeof v === "object") return Object.keys(v).length > 0;
    return true;
  });
}

function formatTR(dt?: string | null) {
  if (!dt) return "—";

  const d = new Date(dt);
  return d.toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function Home() {
  const [marketData, setMarketData] = useState<CoinRow[]>([]);
  const [filters, setFilters] = useState<FilterState>({});
  const [progress, setProgress] = useState<any>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [telegramOpen, setTelegramOpen] = useState(false);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  /* ======================
     LOCAL STORAGE – LOAD
  ====================== */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(FILTER_STORAGE_KEY);
      if (raw) {
        setFilters(JSON.parse(raw));
      }
    } catch (e) {
      console.warn("Filter load failed", e);
    }
  }, []);

  /* ======================
     LOCAL STORAGE – SAVE
  ====================== */
  useEffect(() => {
    try {
      localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(filters));
    } catch (e) {
      console.warn("Filter save failed", e);
    }
  }, [filters]);

  /* ======================
     MARKET DATA LOAD
  ====================== */
  const loadMarket = () => {
    fetchMarket()
      .then((res) => {
        if (Array.isArray(res?.data)) {
          setMarketData(res.data);
          setLastUpdate(res.last_update ?? null); // 🔥 BUNU EKLE
        }
      })
      .catch(() => {});
  };

  // İlk yükleme
  useEffect(() => {
    loadMarket();
  }, []);

  // Progress polling
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE;
  useEffect(() => {
    const interval = setInterval(() => {
      fetch(`${API_BASE}/progress`)
        .then((res) => res.json())
        .then(setProgress)
        .catch(() => {});
    }, 1500);

    return () => clearInterval(interval);
  }, []);

  // Market auto-refresh
  useEffect(() => {
    const interval = setInterval(() => {
      fetch(`${API_BASE}/market`)
        .then((res) => res.json())
        .then((res) => {
          if (Array.isArray(res?.data)) {
            setMarketData(res.data);
            setLastUpdate(res.last_update ?? null);
          }
        })
        .catch(() => {});
    }, 15000);

    return () => clearInterval(interval);
  }, []);

  /* ======================
     FILTER + SCORE
  ====================== */
  const hasFilter = hasActiveFilters(filters);

  const scoredData: ScoredRow[] = marketData
    .map((coin): ScoredRow | null => {
      const result = applyFilters(coin, filters);

      // 🔥 Hard exclude → tamamen çıkar
      if (result.excluded) return null;

      const { passed, total, details } = result;

      return {
        ...coin,
        score: total > 0 ? Math.round((passed / total) * 100) : 0,
        score_details: total > 0 ? details : undefined,
        __filters: filters, // ❗️ _filters DEĞİL, __filters
      };
    })
    .filter((coin): coin is ScoredRow => coin !== null) // ✅ doğru type guard
    .sort((a, b) => {
      if (hasFilter) return (b.score ?? 0) - (a.score ?? 0);
      return (b.price ?? 0) - (a.price ?? 0);
    });

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 p-10">
      <div className="flex items-start justify-between mb-8">
        <h1 className="text-3xl font-bold">Swing Scanner – Binance Futures</h1>

        <div className="flex items-center gap-3">
          {/* SEARCH INPUT */}
          <input
            type="text"
            placeholder="Coin ara..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              if (e.target.value.toLowerCase() === "telegram") {
                setTelegramOpen(true);
                setSearch("");
              }
            }}
            className="w-36 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-zinc-500 transition"
          />

          {/* LAST UPDATE */}
          {lastUpdate && (
            <div className="relative group">
              <div className="bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2 text-xs text-zinc-300 cursor-default">
                <span className="text-zinc-400">Last Update:</span>{" "}
                <span className="text-zinc-100 font-medium">
                  {formatTR(lastUpdate)}
                </span>
              </div>

              {/* TOOLTIP */}
              <div className="absolute right-0 top-full mt-2 w-64 bg-zinc-900 border border-zinc-700 rounded-xl p-4 text-xs opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 space-y-3">
                {/* Sonraki güncelleme */}
                <div>
                  <div className="text-zinc-400 mb-1">Sonraki güncelleme</div>
                  <div className="text-zinc-100 font-medium">
                    {(() => {
                      const d = new Date(lastUpdate);
                      const nextSlot = new Date(now);

                      // Bir sonraki :00 veya :30 slotunu bul
                      const mins = nextSlot.getMinutes();
                      if (mins < 30) {
                        nextSlot.setMinutes(30, 0, 0);
                      } else {
                        nextSlot.setMinutes(0, 0, 0);
                        nextSlot.setHours(nextSlot.getHours() + 1);
                      }

                      const diffMs = nextSlot.getTime() - now.getTime();
                      if (diffMs <= 0) return "Yakında...";
                      const m = Math.floor(diffMs / 60000);
                      const s = Math.floor((diffMs % 60000) / 1000);
                      return `${m}d ${s}s`;
                    })()}
                  </div>
                </div>

                {/* Veri çekimi durumu */}
                <div>
                  <div className="text-zinc-400 mb-1">Veri çekimi</div>
                  {progress?.running ? (
                    <>
                      <div className="flex justify-between text-zinc-300 mb-1">
                        <span>İşleniyor...</span>
                        <span>
                          {progress.total
                            ? `%${Math.round((progress.done / progress.total) * 100)}`
                            : "—"}
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 transition-all"
                          style={{
                            width: progress.total
                              ? `${(progress.done / progress.total) * 100}%`
                              : "0%",
                          }}
                        />
                      </div>
                      <div className="text-zinc-500 mt-1">
                        {progress.done}/{progress.total} coin
                      </div>
                    </>
                  ) : (
                    <div className="text-emerald-400">✓ Hazır</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* FILTER BAR */}
      <FilterBar
        filters={filters}
        onOpen={() => setFilterOpen(true)}
        onRemove={(key) =>
          setFilters((prev) => {
            const copy = { ...prev };
            delete (copy as any)[key];
            return copy;
          })
        }
      />

      {/* FILTER MODAL */}
      {filterOpen && (
        <FilterModal
          filters={filters}
          setFilters={setFilters}
          onClose={() => setFilterOpen(false)}
        />
      )}

      {telegramOpen && <TelegramModal onClose={() => setTelegramOpen(false)} />}

      {/* TABLE / LOADING */}
      {marketData.length === 0 ? (
        <div className="mt-12 max-w-xl">
          <p className="text-zinc-400 text-sm">Veriler hazırlanıyor…</p>
        </div>
      ) : (
        <CoinTable data={scoredData} search={search} />
      )}
    </main>
  );
}
