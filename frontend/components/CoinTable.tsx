import { useState, useMemo } from "react";
import { CoinRow } from "../types";

type SortKey =
  | "symbol"
  | "price"
  | "change24h"
  | "volume"
  | "funding"
  | "circulating_ratio"
  | "rsi_1h"
  | "rsi_4h"
  | "rsi_1d"
  | "stoch_k_1h"
  | "stoch_k_4h"
  | "stoch_k_1d"
  | "ha_1h"
  | "ha_4h"
  | "ha_1d"
  | "score";

type SortDir = "asc" | "desc" | null;

export default function CoinTable({ data }: { data: CoinRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [search, setSearch] = useState("");
  const filteredData = useMemo(() => {
    if (!search.trim()) return data;

    return data.filter((coin) =>
      coin.symbol.toLowerCase().includes(search.toLowerCase()),
    );
  }, [data, search]);

  function handleSort(key: SortKey) {
    // default durumdayken tıklama
    if (sortKey === null) {
      setSortKey(key);
      setSortDir("asc");
      return;
    }

    // aynı sütun
    if (sortKey === key) {
      if (sortDir === "asc") {
        setSortDir("desc");
      } else if (sortDir === "desc") {
        // 3. tık → default
        setSortKey(null);
        setSortDir(null);
      }
      return;
    }

    // başka sütuna tıklandı
    setSortKey(key);
    setSortDir("asc");
  }

  const sortedData = useMemo(() => {
    const copied = [...filteredData];

    // 🔥 DEFAULT: price desc
    if (sortKey === null || sortDir === null) {
      copied.sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
      return copied;
    }

    copied.sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];

      // 🔥 HEIKIN ASHI özel durumu
      if (
        (sortKey === "ha_1h" || sortKey === "ha_4h" || sortKey === "ha_1d") &&
        (aVal === "green" || aVal === "red") &&
        (bVal === "green" || bVal === "red")
      ) {
        const aNum = aVal === "green" ? 1 : 0;
        const bNum = bVal === "green" ? 1 : 0;

        return sortDir === "asc" ? aNum - bNum : bNum - aNum;
      }

      // 🔁 string
      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDir === "asc"
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      // 🔁 number
      const aNum = typeof aVal === "number" ? aVal : 0;
      const bNum = typeof bVal === "number" ? bVal : 0;

      return sortDir === "asc" ? aNum - bNum : bNum - aNum;
    });

    return copied;
  }, [filteredData, sortKey, sortDir]);

  function formatPrice(price?: number) {
    if (price == null) return "—";

    // Büyük fiyatlar → klasik
    if (price >= 1) {
      return `$${price.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;
    }

    // Küçük fiyatlar → anlamlı ondalık
    if (price > 0) {
      return `$${price.toFixed(
        Math.min(8, Math.max(2, Math.ceil(-Math.log10(price)) + 2)),
      )}`;
    }

    return "$0";
  }

  function rsiColor(rsi?: number | null) {
    if (rsi === undefined || rsi === null) return "text-zinc-500";
    if (rsi <= 20) return "text-purple-400";
    if (rsi <= 30) return "text-emerald-400";
    if (rsi >= 80) return "text-rose-500";
    if (rsi >= 70) return "text-orange-400";
    return "text-zinc-300";
  }

  function SortArrow({ column }: { column: SortKey }) {
    if (sortKey !== column) return null;
    if (sortDir === "asc") return <span className="ml-1">↑</span>;
    if (sortDir === "desc") return <span className="ml-1">↓</span>;
    return null;
  }

  const TF_ORDER = ["global", "1d", "4h", "1h"];

  const DETAIL_ORDER = [
    "RSI_RANGE",
    "RSI_SMA_UP",
    "RSI_SMA_DOWN",
    "STOCH_RANGE",
    "STOCH_K_GT_D",
    "STOCH_K_LT_D",
    "HA",
    "MAX_SUPPLY",
  ];

  function formatSupply(value: number): string {
    if (value >= 1_000_000_000_000)
      return `${(value / 1_000_000_000_000).toFixed(2)}T`;

    if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;

    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;

    return value.toLocaleString();
  }

  function formatDetailLabel(key: string, coin: CoinRow) {
    const [type, tf] = key.split("|");
    const tfLabel = `(${tf.toUpperCase()})`;

    if (type === "RSI_RANGE") {
      const min = (coin as any)[`rsi_${tf}`];
      const filter = (coin as any).__filters?.[`rsi_${tf}`];

      const fmin = filter?.min;
      const fmax = filter?.max;

      if (fmin != null && fmax != null) return `RSI ${fmin}-${fmax} ${tfLabel}`;
      if (fmin != null) return `RSI ≥ ${fmin} ${tfLabel}`;
      if (fmax != null) return `RSI ≤ ${fmax} ${tfLabel}`;

      return `RSI ${tfLabel}`;
    }
    if (type === "RSI_SMA_UP") return `RSI SMA ↑ ${tfLabel}`;
    if (type === "RSI_SMA_DOWN") return `RSI SMA ↓ ${tfLabel}`;

    if (type.startsWith("STOCH")) {
      const filter = (coin as any).__filters?.[`stoch_${tf}`];

      if (!filter) return `Stoch ${tfLabel}`;

      if (type === "STOCH_RANGE") {
        if (filter.k_lt != null) return `Stoch K < ${filter.k_lt} ${tfLabel}`;
        return `Stoch aralık ${tfLabel}`;
      }

      if (type === "STOCH_K_GT_D") {
        return `Stoch K > D ${tfLabel}`;
      }

      if (type === "STOCH_K_LT_D") {
        return `Stoch K < D ${tfLabel}`;
      }
    }

    if (type === "HA") {
      const selected = (coin as any).__filters?.[`ha_${tf}`];

      if (selected === "green") return `HA 🟢 ${tfLabel}`;
      if (selected === "red") return `HA 🔴 ${tfLabel}`;
      if (selected === "red_to_green") return `HA 🔴→🟢 ${tfLabel}`;
      if (selected === "green_to_red") return `HA 🟢→🔴 ${tfLabel}`;

      return `HA ${tfLabel}`;
    }

    if (type === "MAX_SUPPLY") {
      const filter = (coin as any).__filters;

      const minRatio =
        filter?.min_circulating_ratio != null
          ? Number(filter.min_circulating_ratio)
          : null;

      if (minRatio != null) {
        return `Max Arz ≥ %${minRatio}`;
      }

      // fallback (filtre yoksa)
      const ratio = coin.circulating_ratio;
      const circ = coin.circulating_supply;
      const max = coin.max_supply;

      if (ratio == null || circ == null || max == null) {
        return "Max Arz bilgisi yok";
      }

      return `Max Arz %${Math.round(ratio)} (${formatSupply(circ)} / ${formatSupply(max)})`;
    }

    return key;
  }

  function Th({
    label,
    column,
    align = "right",
  }: {
    label: string;
    column: SortKey;
    align?: "left" | "right";
  }) {
    return (
      <th
        onClick={() => handleSort(column)}
        className={`px-5 py-4 cursor-pointer select-none text-${align} font-medium text-zinc-400 hover:text-zinc-200 transition`}
      >
        {label}
        <SortArrow column={column} />
      </th>
    );
  }

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 backdrop-blur">
      {/* SEARCH BAR */}
      <div className="p-4 border-b border-zinc-800">
        <input
          type="text"
          placeholder="Coin ara... (BTC, ETH, SOL...)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-sm text-zinc-200 focus:outline-none focus:border-zinc-500"
        />
      </div>
      <table className="w-full text-sm">
        <thead className="border-b border-zinc-800">
          <tr>
            <Th label="Coin" column="symbol" align="left" />
            <Th label="Price" column="price" />
            <Th label="24h %" column="change24h" />
            <Th label="Volume" column="volume" />
            <Th label="Funding" column="funding" />
            <Th label="Arz %" column="circulating_ratio" />
            <Th label="RSI 1H" column="rsi_1h" />
            <Th label="RSI 4H" column="rsi_4h" />
            <Th label="RSI 1D" column="rsi_1d" />
            <Th label="Stoch 1H" column="stoch_k_1h" />
            <Th label="Stoch 4H" column="stoch_k_4h" />
            <Th label="Stoch 1D" column="stoch_k_1d" />
            <Th label="HA 1H" column="ha_1h" />
            <Th label="HA 4H" column="ha_4h" />
            <Th label="HA 1D" column="ha_1d" />
            <Th label="Uygunluk %" column="score" />
          </tr>
        </thead>

        <tbody>
          {sortedData.length === 0 && (
            <tr>
              <td colSpan={16} className="text-center py-8 text-zinc-500">
                Sonuç bulunamadı.
              </td>
            </tr>
          )}
          {sortedData.map((coin) => (
            <tr
              key={coin.symbol}
              className="border-b border-zinc-800 hover:bg-zinc-800/40 transition"
            >
              <td className="px-5 py-4">
                <div className="flex items-center gap-2 font-semibold text-zinc-100">
                  {coin.is_new && (
                    <span className="px-2 py-0.5 text-xs rounded bg-yellow-500/20 text-yellow-400">
                      NEW
                    </span>
                  )}
                  <span>{coin.symbol}</span>
                </div>
              </td>

              <td className="px-5 py-4 text-right text-zinc-200 font-medium">
                {formatPrice(coin.price)}
              </td>

              <td
                className={`px-5 py-4 text-right font-medium ${
                  coin.change24h === undefined
                    ? "text-zinc-400"
                    : coin.change24h >= 0
                      ? "text-emerald-400"
                      : "text-rose-400"
                }`}
              >
                {coin.change24h !== undefined
                  ? `${coin.change24h.toFixed(2)}%`
                  : "—"}
              </td>

              <td className="px-5 py-4 text-right text-zinc-300">
                {coin.volume
                  ? `$${(coin.volume / 1_000_000).toFixed(1)}M`
                  : "—"}
              </td>
              <td
                className={`px-5 py-4 text-right font-medium ${
                  coin.funding === undefined
                    ? "text-zinc-400"
                    : coin.funding < 0
                      ? "text-emerald-400"
                      : "text-rose-400"
                }`}
              >
                {coin.funding !== undefined
                  ? `${(coin.funding * 100).toFixed(4)}%`
                  : "—"}
              </td>
              <td className="px-5 py-4 text-right relative group">
                {coin.circulating_ratio != null ? (
                  <>
                    <span
                      className={`font-medium ${
                        coin.circulating_ratio >= 80
                          ? "text-emerald-400"
                          : coin.circulating_ratio >= 50
                            ? "text-orange-400"
                            : "text-rose-400"
                      }`}
                    >
                      %{Math.round(coin.circulating_ratio)}
                    </span>

                    {/* TOOLTIP */}
                    <div className="absolute right-0 top-full mt-2 inline-flex flex-col items-start gap-1 bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-xs opacity-0 group-hover:opacity-100 transition pointer-events-none z-50">
                      <div className="text-zinc-300 mb-1 font-semibold">
                        Arz Detayı
                      </div>
                      <div className="flex gap-2 text-zinc-400 whitespace-nowrap">
                        Dolaşım:{" "}
                        <span className="text-zinc-200">
                          {coin.circulating_supply?.toLocaleString() ?? "—"}
                        </span>
                      </div>
                      <div className="flex gap-2 text-zinc-400 whitespace-nowrap">
                        Max Arz:{" "}
                        <span className="text-zinc-200">
                          {coin.max_supply?.toLocaleString() ?? "—"}
                        </span>
                      </div>
                    </div>
                  </>
                ) : (
                  <span className="text-zinc-500">—</span>
                )}
              </td>

              <td
                className={`px-5 py-4 text-right font-semibold ${rsiColor(coin.rsi_1h)}`}
              >
                {coin.rsi_1h != null && coin.rsi_sma_1h != null ? (
                  <span className="inline-flex items-center gap-1 justify-end">
                    <span>
                      {Math.round(coin.rsi_1h)} / {Math.round(coin.rsi_sma_1h)}
                    </span>

                    {coin.rsi_cross_up_1h_recent && (
                      <span className="text-emerald-400 text-xs">↑</span>
                    )}
                    {coin.rsi_cross_down_1h_recent && (
                      <span className="text-rose-400 text-xs">↓</span>
                    )}
                  </span>
                ) : (
                  "—"
                )}
              </td>

              <td
                className={`px-5 py-4 text-right font-semibold ${rsiColor(coin.rsi_4h)}`}
              >
                {coin.rsi_4h != null && coin.rsi_sma_4h != null ? (
                  <span className="inline-flex items-center gap-1 justify-end">
                    <span>
                      {Math.round(coin.rsi_4h)} / {Math.round(coin.rsi_sma_4h)}
                    </span>

                    {coin.rsi_cross_up_4h_recent && (
                      <span className="text-emerald-400 text-xs">↑</span>
                    )}
                    {coin.rsi_cross_down_4h_recent && (
                      <span className="text-rose-400 text-xs">↓</span>
                    )}
                  </span>
                ) : (
                  "—"
                )}
              </td>

              <td
                className={`px-5 py-4 text-right font-semibold ${rsiColor(coin.rsi_1d)}`}
              >
                {coin.rsi_1d != null && coin.rsi_sma_1d != null ? (
                  <span className="inline-flex items-center gap-1 justify-end">
                    <span>
                      {Math.round(coin.rsi_1d)} / {Math.round(coin.rsi_sma_1d)}
                    </span>

                    {coin.rsi_cross_up_1d_recent && (
                      <span className="text-emerald-400 text-xs">↑</span>
                    )}
                    {coin.rsi_cross_down_1d_recent && (
                      <span className="text-rose-400 text-xs">↓</span>
                    )}
                  </span>
                ) : (
                  "—"
                )}
              </td>

              <td className="px-5 py-4 text-right text-zinc-300">
                {coin.stoch_k_1h != null && coin.stoch_d_1h != null ? (
                  <span className="inline-flex items-center justify-end gap-1">
                    <span>
                      {coin.stoch_k_1h.toFixed(0)} /{" "}
                      {coin.stoch_d_1h.toFixed(0)}
                    </span>

                    {coin.stoch_cross_up_1h_recent && (
                      <span className="text-emerald-400 text-xs">↑</span>
                    )}
                    {coin.stoch_cross_down_1h_recent && (
                      <span className="text-rose-400 text-xs">↓</span>
                    )}
                  </span>
                ) : (
                  "—"
                )}
              </td>
              <td className="px-5 py-4 text-right text-zinc-300">
                {coin.stoch_k_4h != null && coin.stoch_d_4h != null ? (
                  <span className="inline-flex items-center justify-end gap-1">
                    <span>
                      {coin.stoch_k_4h.toFixed(0)} /{" "}
                      {coin.stoch_d_4h.toFixed(0)}
                    </span>

                    {coin.stoch_cross_up_4h_recent && (
                      <span className="text-emerald-400 text-xs">↑</span>
                    )}
                    {coin.stoch_cross_down_4h_recent && (
                      <span className="text-rose-400 text-xs">↓</span>
                    )}
                  </span>
                ) : (
                  "—"
                )}
              </td>
              <td className="px-5 py-4 text-right text-zinc-300">
                {coin.stoch_k_1d != null && coin.stoch_d_1d != null ? (
                  <span className="inline-flex items-center justify-end gap-1">
                    <span>
                      {coin.stoch_k_1d.toFixed(0)} /{" "}
                      {coin.stoch_d_1d.toFixed(0)}
                    </span>

                    {coin.stoch_cross_up_1d_recent && (
                      <span className="text-emerald-400 text-xs">↑</span>
                    )}
                    {coin.stoch_cross_down_1d_recent && (
                      <span className="text-rose-400 text-xs">↓</span>
                    )}
                  </span>
                ) : (
                  "—"
                )}
              </td>

              {/* HA 1H */}
              <td className="px-5 py-4 text-right">
                {coin.ha_1h === "green" && "🟢"}
                {coin.ha_1h === "red" && "🔴"}
                {coin.ha_1h === "red_to_green" && "🔴→🟢"}
                {coin.ha_1h === "green_to_red" && "🟢→🔴"}
              </td>

              {/* HA 4H */}
              <td className="px-5 py-4 text-right">
                {coin.ha_4h === "green" && "🟢"}
                {coin.ha_4h === "red" && "🔴"}
                {coin.ha_4h === "red_to_green" && "🔴→🟢"}
                {coin.ha_4h === "green_to_red" && "🟢→🔴"}
              </td>

              {/* HA 1D */}
              <td className="px-5 py-4 text-right">
                {coin.ha_1d === "green" && "🟢"}
                {coin.ha_1d === "red" && "🔴"}
                {coin.ha_1d === "red_to_green" && "🔴→🟢"}
                {coin.ha_1d === "green_to_red" && "🟢→🔴"}
              </td>
              <td className="px-5 py-4 relative group">
                {coin.score != null && coin.score > 0 ? (
                  <>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-zinc-800 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            coin.score >= 80
                              ? "bg-emerald-400"
                              : coin.score >= 50
                                ? "bg-orange-400"
                                : "bg-rose-400"
                          }`}
                          style={{ width: `${coin.score}%` }}
                        />
                      </div>

                      <span className="text-xs font-semibold text-zinc-300 w-8 text-right">
                        {Math.ceil(coin.score)}%
                      </span>
                    </div>

                    {/* 🔍 TOOLTIP */}
                    <div className="absolute right-0 top-full mt-2 w-64 bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-xs opacity-0 group-hover:opacity-100 transition pointer-events-none z-50">
                      <div className="font-semibold mb-2 text-zinc-200">
                        Uygunluk Detayı
                      </div>
                      {coin.score_details && coin.score > 0 && (
                        <ul className="space-y-1">
                          {(() => {
                            if (!coin.score_details) return null;

                            const entries = Object.entries(
                              coin.score_details,
                            ).sort(([a], [b]) => {
                              const [typeA, tfA] = a.split("|");
                              const [typeB, tfB] = b.split("|");

                              const typeDiff =
                                DETAIL_ORDER.indexOf(typeA) -
                                DETAIL_ORDER.indexOf(typeB);
                              if (typeDiff !== 0) return typeDiff;

                              return (
                                TF_ORDER.indexOf(tfA) - TF_ORDER.indexOf(tfB)
                              );
                            });

                            const groups: Record<string, [string, boolean][]> =
                              {
                                RSI: [],
                                STOCH: [],
                                HA: [],
                                SUPPLY: [],
                              };

                            for (const item of entries) {
                              const [key] = item;
                              if (key.startsWith("RSI")) groups.RSI.push(item);
                              else if (key.startsWith("STOCH"))
                                groups.STOCH.push(item);
                              else if (key.startsWith("HA"))
                                groups.HA.push(item);
                              else if (key.startsWith("MAX_SUPPLY"))
                                groups.SUPPLY.push(item);
                            }

                            return (
                              <div className="space-y-3">
                                {Object.entries(groups).map(([group, items]) =>
                                  items.length > 0 ? (
                                    <div key={group}>
                                      <div className="text-zinc-400 font-semibold mb-1">
                                        {group === "RSI"
                                          ? "RSI"
                                          : group === "STOCH"
                                            ? "Stochastic RSI"
                                            : group === "HA"
                                              ? "Heikin Ashi"
                                              : "Arz"}
                                      </div>

                                      <ul className="space-y-1">
                                        {items.map(([key, ok]) => (
                                          <li
                                            key={key}
                                            className={`flex justify-between ${
                                              ok
                                                ? "text-emerald-400"
                                                : "text-rose-400"
                                            }`}
                                          >
                                            <span>
                                              {formatDetailLabel(key, coin)}
                                            </span>
                                            <span>{ok ? "✔" : "✖"}</span>
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  ) : null,
                                )}
                              </div>
                            );
                          })()}
                        </ul>
                      )}
                    </div>
                  </>
                ) : (
                  "—"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
