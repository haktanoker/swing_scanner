"use client";

import { useEffect, useState } from "react";
import { fetchMarket } from "../lib/api";
import CoinTable from "../components/CoinTable";
import { applyFilters } from "../lib/filterEngine";
import { CoinRow } from "../types";
import FilterBar from "../components/FilterBar";
import FilterModal from "../components/FilterModal";

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
    if (!progress || !progress.running) return;

    const interval = setInterval(() => {
      fetch(`${API_BASE}/progress`)
        .then(res => res.json())
        .then(setProgress)
        .catch(() => {});
    }, 1500);

    return () => clearInterval(interval);
  }, [progress]);

  // Market auto-refresh
  useEffect(() => {
    const interval = setInterval(() => {
      fetch(`${API_BASE}/market`)
        .then(res => res.json())
        .then(res => {
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
      {lastUpdate && (
        <div className="absolute right-10 top-6 bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2 text-xs text-zinc-300">
          <span className="text-zinc-400">Last Update:</span>{" "}
          <span className="text-zinc-100 font-medium">
            {formatTR(lastUpdate)}
          </span>
        </div>
      )}
      <h1 className="text-3xl font-bold mb-8">
        Swing Scanner – Binance Futures
      </h1>

      {/* PROGRESS BAR */}
      {progress?.running && (
        <div className="mb-6">
          <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all"
              style={{
                width: progress.total
                  ? `${(progress.done / progress.total) * 100}%`
                  : "0%",
              }}
            />
          </div>
          <p className="text-xs text-zinc-400 mt-2">
            Güncelleniyor: {progress.done}/{progress.total}
          </p>
        </div>
      )}

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

      {/* TABLE / LOADING */}
      {marketData.length === 0 ? (
        <div className="mt-12 max-w-xl">
          {progress?.running ? (
            <>
              <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all"
                  style={{
                    width:
                      progress.total && progress.done
                        ? `${Math.min(
                            100,
                            Math.round((progress.done / progress.total) * 100),
                          )}%`
                        : "5%",
                  }}
                />
              </div>

              <div className="flex justify-between text-xs text-zinc-400 mt-2">
                <span>Veriler çekiliyor…</span>
                {progress.total ? (
                  <span>
                    {progress.done}/{progress.total}
                  </span>
                ) : (
                  <span>—</span>
                )}
              </div>
            </>
          ) : (
            <p className="text-zinc-400 text-sm">Veriler hazırlanıyor…</p>
          )}
        </div>
      ) : (
        <CoinTable data={scoredData} />
      )}
    </main>
  );
}
