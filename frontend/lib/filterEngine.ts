import { CoinRow } from "../types";

const TIMEFRAMES = ["1h", "4h", "1d"] as const;

export function applyFilters(
  coin: CoinRow,
  filters: any,
): {
  passed: number;
  total: number;
  details: Record<string, boolean>;
  excluded?: boolean;
} {
  // ==========================
  // 🔥 HARD EXCLUDE FILTERS
  // ==========================

  // ❌ Yeni coinleri tamamen çıkar
  if (filters.new_coin_exclude && coin.is_new) {
    return {
      passed: 0,
      total: 0,
      details: {},
      excluded: true,
    };
  }

  // ❌ Max arz filtresi aktifse → arz bilgisi olmayan coinleri çıkar
  if (filters.max_supply_only) {
    if (
      coin.max_supply == null ||
      coin.circulating_supply == null ||
      coin.circulating_ratio == null
    ) {
      return {
        passed: 0,
        total: 0,
        details: {},
        excluded: true,
      };
    }

    // ❌ Min oran varsa ve tutmuyorsa → tamamen çıkar
    const minRatio =
      filters.min_circulating_ratio != null
        ? Number(filters.min_circulating_ratio)
        : null;

    if (minRatio != null && coin.circulating_ratio < minRatio) {
      return {
        passed: 0,
        total: 0,
        details: {},
        excluded: true,
      };
    }
  }

  // ==========================
  // 🟢 SCORE FILTERS
  // ==========================
  let passed = 0;
  let total = 0;
  const details: Record<string, boolean> = {};

  // ================= TIMEFRAME FILTERS =================
  for (const tf of TIMEFRAMES) {
    // ================= RSI =================
    const rsiFilter = filters[`rsi_${tf}`];
    const rsi = (coin as any)[`rsi_${tf}`];
    const rsiSma = (coin as any)[`rsi_sma_${tf}`];

    if (rsiFilter?.min != null || rsiFilter?.max != null) {
      total++;
      const min = rsiFilter.min ?? -Infinity;
      const max = rsiFilter.max ?? Infinity;
      const ok = rsi != null && rsi >= min && rsi <= max;
      details[`RSI_RANGE|${tf}`] = ok;
      if (ok) passed++;
    }

    if (rsiFilter?.cross_up) {
      total++;
      const ok = rsi != null && rsiSma != null && rsi >= rsiSma;
      details[`RSI_SMA_UP|${tf}`] = ok;
      if (ok) passed++;
    }

    if (rsiFilter?.cross_down) {
      total++;
      const ok = rsi != null && rsiSma != null && rsi <= rsiSma;
      details[`RSI_SMA_DOWN|${tf}`] = ok;
      if (ok) passed++;
    }

    // ================= STOCH =================
    const stochFilter = filters[`stoch_${tf}`];
    const k = (coin as any)[`stoch_k_${tf}`];
    const d = (coin as any)[`stoch_d_${tf}`];

    if (stochFilter?.k_lt != null) {
      total++;
      const ok = k != null && k <= stochFilter.k_lt;
      details[`STOCH_RANGE|${tf}`] = ok;
      if (ok) passed++;
    }

    if (stochFilter?.k_gt_d) {
      total++;
      const ok = k != null && d != null && k >= d;
      details[`STOCH_K_GT_D|${tf}`] = ok;
      if (ok) passed++;
    }

    if (stochFilter?.k_lt_d) {
      total++;
      const ok = k != null && d != null && k <= d;
      details[`STOCH_K_LT_D|${tf}`] = ok;
      if (ok) passed++;
    }

    // ================= HEIKIN ASHI =================
    const haFilter = filters[`ha_${tf}`];
    const ha = (coin as any)[`ha_${tf}`];

    if (haFilter) {
      total++;
      const ok =
        ha === haFilter ||
        (haFilter === "green" && ha === "red_to_green") ||
        (haFilter === "red" && ha === "green_to_red");

      details[`HA|${tf}`] = ok;
      if (ok) passed++;
    }
  }

  return { passed, total, details };
}
