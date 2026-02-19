export function clampRSI(value: string): number | undefined {
  if (value === "") return undefined;

  let num = parseInt(value, 10);
  if (isNaN(num)) return undefined;

  if (num < 0) num = 0;
  if (num > 100) num = 100;

  return num;
}
