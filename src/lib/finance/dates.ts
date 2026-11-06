// Datas no fuso de Brasília. Datas de calendário são strings ISO "YYYY-MM-DD".

export const TZ = "America/Sao_Paulo";

/** Data de hoje em Brasília, "YYYY-MM-DD". */
export function todayISO(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export interface YMD { y: number; m: number; d: number } // m: 1-12

export function parseISO(iso: string): YMD {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return { y, m, d };
}

export function toISO({ y, m, d }: YMD): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** "YYYY-MM" */
export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

export function monthStart(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

export function addMonthsKey(key: string, n: number): string {
  const [y, m] = key.split("-").map(Number);
  const idx = y * 12 + (m - 1) + n;
  const ny = Math.floor(idx / 12);
  const nm = (idx % 12) + 1;
  return `${ny}-${String(nm).padStart(2, "0")}`;
}

/** Diferença em meses entre duas chaves "YYYY-MM" (b - a). */
export function monthsBetweenKeys(a: string, b: string): number {
  const [ay, am] = a.split("-").map(Number);
  const [by, bm] = b.split("-").map(Number);
  return (by - ay) * 12 + (bm - am);
}

/** Data com dia limitado ao último dia do mês. */
export function clampDate(y: number, m: number, d: number): string {
  return toISO({ y, m, d: Math.min(d, daysInMonth(y, m)) });
}

export function daysBetween(a: string, b: string): number {
  const pa = parseISO(a), pb = parseISO(b);
  const ta = Date.UTC(pa.y, pa.m - 1, pa.d);
  const tb = Date.UTC(pb.y, pb.m - 1, pb.d);
  return Math.round((tb - ta) / 86_400_000);
}

export function remainingDaysInMonth(today: string): number {
  const { y, m, d } = parseISO(today);
  return daysInMonth(y, m) - d + 1; // inclui hoje
}

const MONTHS_PT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return `${MONTHS_PT[m - 1]}/${String(y).slice(2)}`;
}

const MONTHS_FULL = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

export function monthLabelFull(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return `${MONTHS_FULL[m - 1]} de ${y}`;
}
