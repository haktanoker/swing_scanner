type Props = {
  filters: Record<string, any>;
  onOpen: () => void;
  onRemove: (key: string) => void;
};

function formatFilterLabel(key: string, value: any, filters: any) {
  if (!value) return "";

  const tf = key.slice(-2).toUpperCase();

  if (key.startsWith("rsi_")) {
    const parts = [];

    if (value.min != null || value.max != null) {
      parts.push(`${value.min ?? 0}-${value.max ?? 100}`);
    }
    if (value.cross_up) parts.push("SMA↑");
    if (value.cross_down) parts.push("SMA↓");

    if (parts.length === 0) return "";
    return `${tf} RSI ${parts.join(" ")}`;
  }

  if (key.startsWith("stoch_")) {
    const parts = [];
    if (value.k_lt != null) parts.push(`K<${value.k_lt}`);
    if (value.k_gt_d) parts.push("K>D");
    if (value.k_lt_d) parts.push("K<D");

    if (parts.length === 0) return "";
    return `${tf} Stoch ${parts.join(" ")}`;
  }

  if (key.startsWith("ha_")) {
    const map: any = {
      green: "🟢",
      red: "🔴",
      red_to_green: "🔴→🟢",
      green_to_red: "🟢→🔴",
    };
    return `${tf} HA ${map[value]}`;
  }

  if (key === "new_coin_exclude") {
    return "Yeni coinler hariç";
  }

  // 🔥 MAX SUPPLY ETİKETİ
  if (key === "max_supply_only") {
    const min = filters.min_circulating_ratio;
    if (min != null) {
      return `Max Arz ≥ %${min}`;
    }
    return "Max Arz Var";
  }

  return "";
}

export default function FilterBar({ filters, onOpen, onRemove }: Props) {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-3">
      <button
        onClick={onOpen}
        className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition"
      >
        Filtreler
      </button>

      {Object.entries(filters).map(([key, value]) => {
        if (!value) return null;

        const label = formatFilterLabel(key, value, filters);
        if (!label) return null;

        return (
          <span
            key={key}
            className="flex items-center gap-2 px-3 py-1 text-sm rounded-full bg-zinc-800"
          >
            {label}
            <button
              onClick={() => onRemove(key)}
              className="text-zinc-400 hover:text-zinc-200"
            >
              ✕
            </button>
          </span>
        );
      })}
    </div>
  );
}
