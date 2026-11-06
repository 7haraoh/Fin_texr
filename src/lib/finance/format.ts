const brlFmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const brlCompact = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", notation: "compact", maximumFractionDigits: 1 });
const pctFmt = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 });

export function brl(v: number): string {
  return brlFmt.format(Number.isFinite(v) ? v : 0);
}

export function brlShort(v: number): string {
  return Math.abs(v) >= 10_000 ? brlCompact.format(v) : brl(v);
}

/** v em fração (0.25 → 25%) */
export function pct(v: number): string {
  return pctFmt.format(Number.isFinite(v) ? v : 0);
}

/** "2026-11-06" → "06/11/2026" */
export function dateBR(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

export function monthsText(n: number): string {
  if (!Number.isFinite(n)) return "indeterminado";
  const r = Math.round(n * 10) / 10;
  if (r < 1) return `${Math.max(0, Math.round(n * 30))} dias`;
  return `${r.toLocaleString("pt-BR")} ${r === 1 ? "mês" : "meses"}`;
}
