// Substitui src/lib/data.ts: as páginas leem os dados do armazenamento da página.
import { analyze } from "@/lib/finance/analyze";
import { todayISO } from "@/lib/finance/dates";
import { financialData, getState } from "./store";

let memo: { version: number; value: ReturnType<typeof build> } | null = null;
function build() {
  const data = financialData();
  const today = todayISO();
  return { data, today, userId: "me", email: null as string | null, analysis: analyze(data, today) };
}
export function analysisNow() {
  const v = getState().version;
  if (!memo || memo.version !== v) memo = { version: v, value: build() };
  return memo.value;
}
export async function loadFinancialData() { const { analysis: _a, ...rest } = analysisNow(); return rest; }
export async function loadAnalysis() { return analysisNow(); }
export async function recordMonthlySnapshot() { /* gravado a cada alteração (actions-shim) */ }
