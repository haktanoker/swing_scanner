import { useState, useEffect } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE;

type Props = {
  onClose: () => void;
};

type TF = "1h" | "4h" | "1d";

function clamp(val: string): number | undefined {
  const n = parseFloat(val);
  if (isNaN(n)) return undefined;
  return Math.min(100, Math.max(0, n));
}

function TelegramTimeframeColumn({ label, tf, filters, setFilters }: any) {
  const rsiKey = `rsi_${tf}`;
  const stochKey = `stoch_${tf}`;
  const haKey = `ha_${tf}`;

  const rsi = filters[rsiKey] || {};
  const stoch = filters[stochKey] || {};
  const ha = filters[haKey] || "";

  function updateRSIField(field: "min" | "max", value: string) {
    const v = clamp(value);
    setFilters((prev: any) => {
      const next = { ...prev };
      const current = { ...(next[rsiKey] || {}) };
      if (v == null) delete current[field];
      else current[field] = v;
      const hasAny = current.min != null || current.max != null || current.cross_up || current.cross_down;
      if (!hasAny) delete next[rsiKey];
      else next[rsiKey] = current;
      return next;
    });
  }

  return (
    <div className="flex-1 border border-zinc-700 rounded-xl p-4 space-y-5">
      <h3 className="font-semibold text-center text-zinc-200">{label}</h3>

      {/* RSI */}
      <div>
        <div className="text-sm mb-1 text-zinc-400">RSI</div>
        <div className="flex gap-2">
          <input
            className="w-20 bg-zinc-800 px-2 py-1 rounded text-zinc-100"
            placeholder="Min"
            value={rsi.min ?? ""}
            onChange={(e) => updateRSIField("min", e.target.value)}
          />
          <input
            className="w-20 bg-zinc-800 px-2 py-1 rounded text-zinc-100"
            placeholder="Max"
            value={rsi.max ?? ""}
            onChange={(e) => updateRSIField("max", e.target.value)}
          />
        </div>
        <label className="flex items-center gap-2 text-xs text-zinc-300 mt-2">
          <input
            type="checkbox"
            checked={rsi.cross_up ?? false}
            onChange={(e) =>
              setFilters((f: any) => ({
                ...f,
                [rsiKey]: { ...f[rsiKey], cross_up: e.target.checked || undefined },
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
                [rsiKey]: { ...f[rsiKey], cross_down: e.target.checked || undefined },
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
          className="w-full bg-zinc-800 px-2 py-1 rounded mb-2 text-zinc-100"
          placeholder="K <"
          value={stoch.k_lt ?? ""}
          onChange={(e) =>
            setFilters((f: any) => ({
              ...f,
              [stochKey]: { ...f[stochKey], k_lt: clamp(e.target.value) },
            }))
          }
        />
        <label className="flex items-center gap-2 text-xs text-zinc-300">
          <input
            type="checkbox"
            checked={stoch.k_gt_d ?? false}
            onChange={(e) =>
              setFilters((f: any) => ({
                ...f,
                [stochKey]: { ...f[stochKey], k_gt_d: e.target.checked || undefined },
              }))
            }
          />
          K &gt; D
        </label>
      </div>

      {/* HEIKIN ASHI */}
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
          className="w-full bg-zinc-800 px-2 py-1 rounded text-zinc-100"
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

export default function TelegramModal({ onClose }: Props) {
  const [enabled, setEnabled] = useState(false);
  const [filters, setFilters] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  // Mevcut ayarları yükle
  useEffect(() => {
    fetch(`${API_BASE}/telegram/settings`)
      .then((r) => r.json())
      .then((d) => {
        setEnabled(d.enabled ?? false);
        setFilters(d.filters ?? {});
      })
      .catch(() => {});
  }, []);

  async function handleSave() {
    setSaving(true);
    setSaveMsg("");
    try {
      const res = await fetch(`${API_BASE}/telegram/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled, filters }),
      });
      if (res.ok) setSaveMsg("✅ Kaydedildi!");
      else setSaveMsg("❌ Kayıt hatası");
    } catch {
      setSaveMsg("❌ Bağlantı hatası");
    }
    setSaving(false);
    setTimeout(() => setSaveMsg(""), 3000);
  }

  async function handleTest() {
    setTesting(true);
    try {
      const res = await fetch(`${API_BASE}/telegram/test`, { method: "POST" });
      const d = await res.json();
      setSaveMsg(d.status === "ok" ? "✅ Test mesajı gönderildi!" : "❌ Gönderilemedi");
    } catch {
      setSaveMsg("❌ Bağlantı hatası");
    }
    setTesting(false);
    setTimeout(() => setSaveMsg(""), 4000);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center">
      <div className="w-[1000px] max-h-[90vh] overflow-y-auto bg-zinc-900 border border-zinc-700 p-6 rounded-2xl">
        {/* HEADER */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <span className="text-2xl">✈️</span>
            <h2 className="text-lg font-semibold text-zinc-100">Telegram Bildirim Ayarları</h2>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-200 text-xl">✕</button>
        </div>

        {/* ENABLE TOGGLE */}
        <div className="flex items-center gap-3 mb-6 p-4 bg-zinc-800 rounded-xl">
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-zinc-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-emerald-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
          </label>
          <span className="text-zinc-200 font-medium">
            Telegram bildirimleri {enabled ? "aktif" : "devre dışı"}
          </span>
          {enabled && (
            <span className="ml-auto text-xs text-zinc-400">Her 30 dakikada kontrol edilir</span>
          )}
        </div>

        {/* FİLTRELER */}
        <div className={!enabled ? "opacity-40 pointer-events-none" : ""}>
          <p className="text-sm text-zinc-400 mb-4">
            Bu filtreler tablodaki filtrelerden <b className="text-zinc-200">bağımsızdır</b>. Yalnızca Telegram bildirimleri için geçerlidir.
          </p>

          <div className="flex gap-4 mb-6">
            <TelegramTimeframeColumn label="1H" tf="1h" filters={filters} setFilters={setFilters} />
            <TelegramTimeframeColumn label="4H" tf="4h" filters={filters} setFilters={setFilters} />
            <TelegramTimeframeColumn label="1D" tf="1d" filters={filters} setFilters={setFilters} />
          </div>

          {/* EK FİLTRELER */}
          <div className="flex flex-wrap gap-6 mb-6">
            <label className="flex items-center gap-2 text-sm text-zinc-300">
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
              Yeni coinleri hariç tut
            </label>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={filters.max_supply_only ?? false}
                onChange={(e) =>
                  setFilters((f: any) => ({
                    ...f,
                    max_supply_only: e.target.checked || undefined,
                    min_circulating_ratio: e.target.checked ? f.min_circulating_ratio : undefined,
                  }))
                }
              />
              <span className="text-sm text-zinc-300">Sadece Max Arz Olanlar</span>
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
                    min_circulating_ratio: e.target.value === "" ? undefined : Number(e.target.value),
                  }))
                }
                className={`w-20 px-2 py-1 rounded bg-zinc-800 text-zinc-100 ${
                  !filters.max_supply_only ? "opacity-40 cursor-not-allowed" : ""
                }`}
              />
            </div>
          </div>
        </div>

        {/* ALT BUTONLAR */}
        <div className="flex items-center justify-between border-t border-zinc-800 pt-4">
          <div className="flex gap-3">
            <button
              onClick={handleTest}
              disabled={testing}
              className="px-4 py-2 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-sm text-zinc-200 transition disabled:opacity-50"
            >
              {testing ? "Gönderiliyor..." : "📨 Test Mesajı Gönder"}
            </button>
            {saveMsg && <span className="text-sm self-center">{saveMsg}</span>}
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setFilters({})}
              className="text-rose-400 text-sm hover:text-rose-300"
            >
              Filtreleri sıfırla
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm font-medium transition disabled:opacity-50"
            >
              {saving ? "Kaydediliyor..." : "Kaydet"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}