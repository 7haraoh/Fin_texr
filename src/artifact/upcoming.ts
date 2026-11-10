// Próximas contas: o que sai do caixa nos próximos dias, a partir dos dados cadastrados.
import type { Analysis } from "@/lib/finance/analyze";
import type { FinancialData } from "@/lib/finance/types";
import { num } from "@/lib/finance/types";
import { addMonthsKey, clampDate, daysBetween, monthKey, parseISO } from "@/lib/finance/dates";

export interface Upcoming {
  id: string;
  label: string;
  detail: string;
  amount: number;
  date: string | null;   // null = sem dia definido (mostra o mês)
  monthKey: string;
  kind: "cartao" | "parcela" | "conta" | "agendado";
  overdue?: boolean;
}

export function upcomingBills(data: FinancialData, a: Analysis, today: string, horizonDays = 40): Upcoming[] {
  const out: Upcoming[] = [];
  const cur = monthKey(today);
  const { d: day } = parseISO(today);
  const nextDate = (dueDay: number) => {
    const thisMonth = clampDate(...(cur.split("-").map(Number) as [number, number]), dueDay);
    if (dueDay >= day) return thisMonth;
    const [y, m] = addMonthsKey(cur, 1).split("-").map(Number);
    return clampDate(y, m, dueDay);
  };

  for (const c of a.snapshot.cards) {
    for (const s of c.statements) {
      if (s.remaining <= 0.009) continue;
      if (!s.overdue && daysBetween(today, s.dueDate) > horizonDays) continue;
      out.push({ id: `card-${c.card.id}-${s.closeKey}`, label: `Fatura ${c.card.name}`, detail: s.overdue ? "vencida" : s.state === "aberta" ? "fatura aberta" : "fatura fechada", amount: s.remaining, date: s.dueDate, monthKey: monthKey(s.dueDate), kind: "cartao", overdue: s.overdue });
    }
  }

  for (const d of data.debts) {
    const pay = num(d.monthly_payment);
    if (pay <= 0 || d.remaining_installments === 0) continue;
    const date = d.due_day ? nextDate(d.due_day) : null;
    const mk = date ? monthKey(date) : addMonthsKey(cur, 1);
    out.push({ id: `debt-${d.id}`, label: d.name, detail: d.remaining_installments ? `${d.remaining_installments - 1 > 0 ? `faltam ${d.remaining_installments - 1} depois desta` : "última parcela"}` : "parcela mensal", amount: pay, date, monthKey: mk, kind: "parcela" });
  }

  for (const r of a.snapshot.recurring) {
    if (r.recurrence !== "mensal") continue;
    const tx = data.transactions.find((t) => t.description === r.description && t.occurred_on === r.lastDate);
    if (!tx || tx.payment_method === "credito") continue; // no cartão já entra na fatura
    const { y, m, d } = parseISO(r.lastDate);
    const [ny, nm] = addMonthsKey(`${y}-${String(m).padStart(2, "0")}`, 1).split("-").map(Number);
    const date = r.lastDate > today ? r.lastDate : clampDate(ny, nm, d);
    if (daysBetween(today, date) > horizonDays) continue;
    out.push({ id: `rec-${tx.id}`, label: r.description, detail: "conta mensal", amount: r.amount, date, monthKey: monthKey(date), kind: "conta" });
  }

  for (const t of data.transactions) {
    if (t.kind !== "expense" || t.occurred_on <= today || t.payment_method === "credito" || t.recurrence !== "nenhuma") continue;
    if (daysBetween(today, t.occurred_on) > horizonDays) continue;
    out.push({ id: `tx-${t.id}`, label: t.description, detail: "agendado", amount: num(t.amount), date: t.occurred_on, monthKey: monthKey(t.occurred_on), kind: "agendado" });
  }

  return out.sort((x, y) => (x.date ?? `${x.monthKey}-99`).localeCompare(y.date ?? `${y.monthKey}-99`));
}
