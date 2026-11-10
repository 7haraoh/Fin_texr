// Ciclo do salário: do dia em que o salário cai até o próximo pagamento.
// É assim que o dinheiro é vivido: com cada salário pagam-se as contas que vencem
// até o salário seguinte, separa-se a reserva e o resto é livre.

import type { Analysis } from "@/lib/finance/analyze";
import { statementKeyForPurchase, statementDates } from "@/lib/finance/cards";
import { addMonthsKey, clampDate, monthKey, monthsBetweenKeys, parseISO, daysBetween } from "@/lib/finance/dates";
import { num, round2, type FinancialData, type IncomeSource } from "@/lib/finance/types";

export interface CycleBill {
  id: string;
  label: string;
  detail: string;
  amount: number;
  date: string | null; // null: sem dia definido (paga dentro do ciclo)
  kind: "cartao" | "parcela" | "conta" | "agendado";
}

export interface Cycle {
  start: string;          // dia do salário que abre o ciclo
  end: string;            // próximo salário (exclusivo)
  days: number;
  salary: number;
  salarySources: IncomeSource[];
  bills: CycleBill[];
  billsTotal: number;
  reserve: number;        // reserva e metas planejadas para este ciclo
  reserveDetail: { name: string; amount: number }[];
  spentOutsideCard: number; // gastos à vista já lançados dentro do ciclo (fora das contas)
  cardSpending: number;     // compras no cartão dentro do ciclo (vão para a próxima fatura)
  free: number;
  perDay: number;
  remainingDays: number;
}

/** Dia do pagamento: o do salário cadastrado (ou dia 5). */
export function payDay(data: FinancialData): number {
  const salary = data.incomes.find((i) => i.active && i.type === "salario" && i.pay_day);
  return salary?.pay_day ?? 5;
}

function payDate(key: string, day: number) {
  const [y, m] = key.split("-").map(Number);
  return clampDate(y, m, day);
}

/** Ciclo que começa no salário do mês `startKey`. */
export function cycleFor(data: FinancialData, a: Analysis, startKey: string, today: string): Cycle {
  const day = payDay(data);
  const start = payDate(startKey, day);
  const end = payDate(addMonthsKey(startKey, 1), day);
  const inCycle = (d: string) => d >= start && d < end;
  const bills: CycleBill[] = [];
  const curKey = monthKey(today);

  // Salário (sem benefícios de uso restrito)
  const salarySources = data.incomes.filter((i) => i.active && i.type !== "beneficio" && i.frequency === "mensal");
  const salary = round2(salarySources.reduce((t, i) => t + num(i.net_amount), 0));

  // Faturas que vencem no ciclo: valor lançado + assinaturas/recorrências do cartão ainda não lançadas naquele mês
  for (const st of a.snapshot.cards) {
    const card = st.card;
    // fechamentos cujo vencimento cai no ciclo
    for (let k = -1; k <= 2; k++) {
      const closeKey = addMonthsKey(startKey, k);
      const { dueDate } = statementDates(closeKey, card.closing_day, card.due_day);
      if (!inCycle(dueDate)) continue;
      const real = st.statements.find((s) => s.closeKey === closeKey);
      let amount = real?.remaining ?? 0;
      const parts: string[] = [];
      for (const r of a.snapshot.recurring) {
        const tx = data.transactions.find((t) => t.description === r.description && t.occurred_on === r.lastDate);
        if (!tx || tx.payment_method !== "credito" || tx.card_id !== card.id || r.recurrence !== "mensal") continue;
        const launchedKey = statementKeyForPurchase(r.lastDate, card.closing_day);
        if (launchedKey < closeKey) { amount += r.amount; parts.push(r.description.replace(/\s*\(.*\)$/, "")); }
      }
      if (amount > 0.009) bills.push({ id: `card-${card.id}-${closeKey}`, label: `Fatura ${card.name}`, detail: parts.length ? `inclui previsão: ${parts.join(", ")}` : real?.state === "aberta" ? "fatura aberta" : "fatura fechada", amount: round2(amount), date: dueDate, kind: "cartao" });
    }
  }

  // Parcelas (uma por ciclo enquanto restarem)
  for (const d of data.debts) {
    const pay = num(d.monthly_payment);
    if (pay <= 0) continue;
    const idx = monthsBetweenKeys(curKey, startKey); // mês atual conta como parcela 1 das restantes
    if (d.remaining_installments !== null && d.remaining_installments !== undefined && idx >= d.remaining_installments) continue;
    const date = d.due_day ? (() => { const dt = payDate(startKey, d.due_day!); return dt < start ? payDate(addMonthsKey(startKey, 1), d.due_day!) : dt; })() : null;
    const left = d.remaining_installments ? d.remaining_installments - idx - 1 : null;
    bills.push({ id: `debt-${d.id}`, label: d.name, detail: left === null ? "parcela mensal" : left > 0 ? `depois desta faltam ${left}` : "última parcela", amount: pay, date, kind: "parcela" });
  }

  // Contas mensais fora do cartão (ex.: celular)
  for (const r of a.snapshot.recurring) {
    if (r.recurrence !== "mensal") continue;
    const tx = data.transactions.find((t) => t.description === r.description && t.occurred_on === r.lastDate);
    if (!tx || tx.payment_method === "credito") continue;
    const { d } = parseISO(r.lastDate);
    let date = payDate(startKey, d);
    if (date < start) date = payDate(addMonthsKey(startKey, 1), d);
    if (!inCycle(date) || date < r.lastDate) continue;
    bills.push({ id: `rec-${tx.id}-${startKey}`, label: r.description, detail: "conta mensal", amount: r.amount, date, kind: "conta" });
  }

  // Pagamentos agendados (não recorrentes, fora do cartão)
  const scheduledIds = new Set<string>();
  for (const t of data.transactions) {
    if (t.kind !== "expense" || t.payment_method === "credito" || t.recurrence !== "nenhuma" || !inCycle(t.occurred_on)) continue;
    if (t.created_at && t.occurred_on <= String(t.created_at).slice(0, 10)) continue; // gasto comum, não agendado
    scheduledIds.add(t.id);
    bills.push({ id: `tx-${t.id}`, label: t.description, detail: "agendado", amount: num(t.amount), date: t.occurred_on, kind: "agendado" });
  }

  bills.sort((x, y) => (x.date ?? "9999").localeCompare(y.date ?? "9999"));
  const billsTotal = round2(bills.reduce((t, b) => t + b.amount, 0));

  // Reserva e metas planejadas para o ciclo
  const reserveDetail = data.goals
    .filter((g) => g.status === "ativa")
    .map((g) => ({ name: g.name, amount: num(g.schedule?.[startKey] ?? g.monthly_contribution) }))
    .filter((g) => g.amount > 0);
  const reserve = round2(reserveDetail.reduce((t, g) => t + g.amount, 0));

  // Gastos já lançados dentro do ciclo que não são contas previstas
  const lastDay = today < end ? today : end;
  const cycleTx = data.transactions.filter((t) => t.kind === "expense" && t.occurred_on >= start && t.occurred_on <= lastDay && t.recurrence === "nenhuma" && !scheduledIds.has(t.id));
  const spentOutsideCard = round2(cycleTx.filter((t) => t.payment_method !== "credito").reduce((s, t) => s + num(t.amount), 0));
  const cardSpending = round2(cycleTx.filter((t) => t.payment_method === "credito").reduce((s, t) => s + num(t.amount), 0));

  const free = round2(salary - billsTotal - reserve - spentOutsideCard);
  const days = daysBetween(start, end);
  const remainingDays = today >= start ? Math.max(1, daysBetween(today, end)) : days;
  return {
    start, end, days, salary, salarySources, bills, billsTotal, reserve, reserveDetail, spentOutsideCard, cardSpending,
    free, perDay: round2(Math.max(0, free) / remainingDays), remainingDays,
  };
}

/**
 * Ciclo a mostrar: o atual (salário já recebido) ou, se o salário deste ciclo
 * caiu antes de o app começar a ser usado, o próximo.
 */
export function relevantCycle(data: FinancialData, a: Analysis, today: string): { cycle: Cycle; upcoming: boolean } {
  const day = payDay(data);
  const cur = monthKey(today);
  const curStartKey = today >= payDate(cur, day) ? cur : addMonthsKey(cur, -1);
  const firstUse = [...data.transactions, ...data.incomes].map((r) => String((r as { created_at?: string }).created_at ?? "")).filter(Boolean).sort()[0]?.slice(0, 10) ?? today;
  const startedBeforeApp = payDate(curStartKey, day) < firstUse;
  const key = startedBeforeApp ? addMonthsKey(curStartKey, 1) : curStartKey;
  return { cycle: cycleFor(data, a, key, today), upcoming: startedBeforeApp };
}
