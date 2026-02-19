export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ||
  "https://swing-api.haktanoker.com";

export async function fetchSymbols() {
  const res = await fetch(`${API_BASE}/symbols`);
  if (!res.ok) {
    throw new Error("API error");
  }
  return res.json();
}

export async function fetchMarket() {
  const res = await fetch(`${API_BASE}/market`);
  const json = await res.json();
  return json.data;
}
