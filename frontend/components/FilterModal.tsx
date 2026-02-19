import { useState } from "react";
import { clampRSI } from "../lib/validators";

type Props = {
  filters: any;
  setFilters: (f: any) => void;
  onClose: () => void;
};

type TF = "1h" | "4h" | "1d";

function TimeframeColumn({ label, tf, filters, setFilters }: any) {
  const rsiKey = `rsi_${tf}`;
  const stochKey = `stoch_${tf}`;
  const haKey = `ha_${tf}`;

  const rsi = filters[rsiKey] || {};
  const stoch = filters[stochKey] || {};
  const ha = filters[haKey] || "";

  const [draft, setDraft] = useState({
    gt: rsi.gt?.toString() ?? "",
    lt: rsi.lt?.toString() ?? "",
  });

  function updateRSIField(field: "min" | "max", value: string) {
    const v = clampRSI(value);

    setFilters((prev: any) => {
      const next = { ...prev };
      const current = { ...(next[rsiKey] || {}) };

      if (v == null) {
        delete current[field];
      } else {
        current[field] = v;
      }

      // 🔥 HİÇBİR ŞEY KALMADIYSA ANAHTARI SİL
      const hasAny =
        current.min != null ||
        current.max != null ||
        current.cross_up ||
        current.cross_down;

      if (!hasAny) {
        delete next[rsiKey];
      } else {
        next[rsiKey] = current;
      }

      return next;
    });
  }

  return (
    <div className="flex-1 border border-zinc-800 rounded-xl p-4 space-y-5">
      <h3 className="font-semibold text-center">{label}</h3>

      {/* RSI */}
      <div>
        <div className="text-sm mb-1 text-zinc-400">RSI</div>

        <div className="flex gap-2">
          <input
            className="w-20 bg-zinc-800 px-2 py-1 rounded"
            placeholder="Min"
            value={rsi.min ?? ""}
            onChange={(e) => updateRSIField("min", e.target.value)}
          />

          <input
            className="w-20 bg-zinc-800 px-2 py-1 rounded"
            placeholder="Max"
            value={rsi.max ?? ""}
            onChange={(e) => updateRSIField("max", e.target.value)}
          />
        </div>

        {/* SMA KESİŞİMLERİ */}
        <label className="flex items-center gap-2 text-xs text-zinc-300 mt-2">
          <input
            type="checkbox"
            checked={rsi.cross_up ?? false}
            onChange={(e) =>
              setFilters((f: any) => ({
                ...f,
                [rsiKey]: {
                  ...f[rsiKey],
                  cross_up: e.target.checked || undefined,
                },
              }))
            }
          />
          RSI SMA ↑
        </label>

        <label className="flex items-center gap-2 text-xs text-zinc-300 mt-1">
          <input
            type="checkbox"
            checked={rsi.cross_down ?? false}
            onChange={(e) =>
              setFilters((f: any) => ({
                ...f,
                [rsiKey]: {
                  ...f[rsiKey],
                  cross_down: e.target.checked || undefined,
                },
              }))
            }
          />
          RSI SMA ↓
        </label>
      </div>

      {/* STOCH */}
      <div>
        <div className="text-sm mb-1 text-zinc-400">Stochastic</div>
        <input
          className="w-full bg-zinc-800 px-2 py-1 rounded mb-2"
          placeholder="K <"
          value={stoch.k_lt ?? ""}
          onChange={(e) =>
            setFilters((f: any) => ({
              ...f,
              [stochKey]: { ...f[stochKey], k_lt: clampRSI(e.target.value) },
            }))
          }
        />
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={stoch.k_gt_d ?? false}
            onChange={(e) =>
              setFilters((f: any) => ({
                ...f,
                [stochKey]: {
                  ...f[stochKey],
                  k_gt_d: e.target.checked || undefined,
                },
              }))
            }
          />
          K &gt; D
        </label>
      </div>

      {/* HEIKIN */}
      <div>
        <div className="text-sm mb-1 text-zinc-400">Heikin Ashi</div>
        <select
          value={ha}
          onChange={(e) =>
            setFilters((f: any) => ({
              ...f,
              [haKey]: e.target.value || undefined,
            }))
          }
          className="w-30 bg-zinc-800 px-2 py-1 rounded"
        >
          <option value="">—</option>
          <option value="green">🟢</option>
          <option value="red">🔴</option>
          <option value="red_to_green">🔴→🟢</option>
          <option value="green_to_red">🟢→🔴</option>
        </select>
      </div>
    </div>
  );
}

export default function FilterModal({ filters, setFilters, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center">
      <div className="w-[1000px] bg-zinc-900 border border-zinc-800 p-6 rounded-2xl">
        <div className="flex justify-between mb-6">
          <h2 className="text-lg font-semibold">Filtreler</h2>
          <button onClick={onClose}>✕</button>
        </div>

        <div className="flex gap-4 mb-6">
          <TimeframeColumn
            label="1H"
            tf="1h"
            filters={filters}
            setFilters={setFilters}
          />
          <TimeframeColumn
            label="4H"
            tf="4h"
            filters={filters}
            setFilters={setFilters}
          />
          <TimeframeColumn
            label="1D"
            tf="1d"
            filters={filters}
            setFilters={setFilters}
          />
        </div>

        <label className="flex items-center gap-2 mb-6">
          <input
            type="checkbox"
            checked={filters.new_coin_exclude ?? false}
            onChange={(e) =>
              setFilters((f: any) => ({
                ...f,
                new_coin_exclude: e.target.checked || undefined,
              }))
            }
          />
          <span className="whitespace-nowrap">Yeni coinleri hariç tut</span>
        </label>

        {/* ================= MAX ARZ ================= */}
        <div className="flex items-center gap-2 mb-6 ">
          <input
            type="checkbox"
            checked={filters.max_supply_only ?? false}
            onChange={(e) =>
              setFilters((f: any) => ({
                ...f,
                max_supply_only: e.target.checked || undefined,
                min_circulating_ratio: e.target.checked
                  ? f.min_circulating_ratio
                  : undefined,
              }))
            }
          />

          <span className="whitespace-nowrap">Sadece Max Arz Olanlar</span>

          <input
            type="number"
            min={0}
            max={100}
            placeholder="Min %"
            disabled={!filters.max_supply_only}
            value={filters.min_circulating_ratio ?? ""}
            onChange={(e) =>
              setFilters((f: any) => ({
                ...f,
                min_circulating_ratio:
                  e.target.value === "" ? undefined : Number(e.target.value),
              }))
            }
            className={`w-20 px-2 py-1 rounded bg-zinc-800 text-zinc-100 ${
              !filters.max_supply_only ? "opacity-40 cursor-not-allowed" : ""
            }`}
          />
        </div>

        <div className="flex justify-between">
          <button onClick={() => setFilters({})} className="text-rose-400">
            Tüm filtreleri sıfırla
          </button>
          <button onClick={onClose} className="px-4 py-2 bg-zinc-800 rounded">
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
}
