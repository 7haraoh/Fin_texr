// Ciclo do salário: do dia em que o salário cai até o próximo pagamento.
// É assim que o dinheiro é vivido: com cada salário pagam-se as contas que vencem
// até o salário seguinte, separa-se a reserva e o resto é livre.

import type { Analysis } from "@/lib/finance/analyze";
import { statementKeyForPurchase, statementDates } from "@/lib/finance/cards";
import { addMonthsKey, clampDate, monthKey, monthsBetweenKeys, parseISO, daysBetween } from "@/lib/finance/dates";
import { num, round2, type FinancialData, type IncomeSource } from "@/lib/finance/types";
import { isInvestmentCategory } from "@/lib/finance/snapshot";
import type { BillPayment } from "./store";

const slug = (s: string) => s.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);

export interface CycleBill {
  id: string;            // chave estável da conta (para registrar pagamento)
  ref: { cardId?: string; closeKey?: string; debtId?: string; templateTxId?: string; txId?: string };
  paid?: { id: string; amount: number; paid_on: string };
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
  paidTotal: number;
  key: string;            // "YYYY-MM" do salário que abre o ciclo
  saved: number;          // já guardado em reserva/metas neste ciclo
  reserve: number;        // reserva e metas planejadas para este ciclo
  reserveDetail: { name: string; amount: number }[];
  spentOutsideCard: number; // gastos à vista já lançados dentro do ciclo (fora das contas)
  cardSpending: number;     // compras no cartão dentro do ciclo (vão para a próxima fatura)
  savingStart: string;
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
export function cycleFor(data: FinancialData, a: Analysis, startKey: string, today: string, payments: BillPayment[] = [], anchorKey = startKey, savingsFrom?: string): Cycle {
  const paidRec = (billKey: string, key = startKey) => payments.find((p) => p.bill_key === billKey && p.cycle_key === key);
  const paidInfo = (billKey: string) => { const p = paidRec(billKey); return p ? { id: p.id, amount: num(p.amount), paid_on: p.paid_on } : undefined; };
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
      const id = `card-${card.id}-${closeKey}`;
      const paid = paidInfo(id);
      if (paid) bills.push({ id, ref: { cardId: card.id, closeKey }, paid, label: `Fatura ${card.name}`, detail: "paga", amount: paid.amount, date: dueDate, kind: "cartao" });
      else if (amount > 0.009) bills.push({ id, ref: { cardId: card.id, closeKey }, label: `Fatura ${card.name}`, detail: parts.length ? `inclui previsão: ${parts.join(", ")}` : real?.state === "aberta" ? "fatura aberta" : "fatura fechada", amount: round2(amount), date: dueDate, kind: "cartao" });
    }
  }

  // Parcelas (uma por ciclo enquanto restarem)
  for (const d of data.debts) {
    const pay = num(d.monthly_payment);
    if (pay <= 0) continue;
    const id = `debt-${d.id}`;
    const date = d.due_day ? (() => { const dt = payDate(startKey, d.due_day!); return dt < start ? payDate(addMonthsKey(startKey, 1), d.due_day!) : dt; })() : null;
    const paid = paidInfo(id);
    if (paid) { bills.push({ id, ref: { debtId: d.id }, paid, label: d.name, detail: d.remaining_installments ? `paga · faltam ${d.remaining_installments}` : "paga", amount: paid.amount, date, kind: "parcela" }); continue; }
    // remaining_installments = parcelas ainda não pagas; a primeira em aberto é a do ciclo-âncora (ou a seguinte, se já paga)
    const firstOpen = paidRec(id, anchorKey) ? addMonthsKey(anchorKey, 1) : anchorKey;
    const k = monthsBetweenKeys(firstOpen, startKey);
    if (k < 0) continue;
    if (d.remaining_installments !== null && d.remaining_installments !== undefined && k >= d.remaining_installments) continue;
    const left = d.remaining_installments ? d.remaining_installments - k - 1 : null;
    bills.push({ id, ref: { debtId: d.id }, label: d.name, detail: left === null ? "parcela mensal" : left > 0 ? `depois desta faltam ${left}` : "última parcela", amount: pay, date, kind: "parcela" });
  }

  // Contas mensais fora do cartão (ex.: celular)
  for (const r of a.snapshot.recurring) {
    if (r.recurrence !== "mensal") continue;
    const tx = data.transactions.find((t) => t.description === r.description && t.occurred_on === r.lastDate);
    if (!tx || tx.payment_method === "credito") continue;
    const { d } = parseISO(r.lastDate);
    let date = payDate(startKey, d);
    if (date < start) date = payDate(addMonthsKey(startKey, 1), d);
    const id = `rec-${slug(r.description)}`;
    const paid = paidInfo(id);
    if (paid) { bills.push({ id, ref: { templateTxId: tx.id }, paid, label: r.description, detail: "paga", amount: paid.amount, date: paid.paid_on, kind: "conta" }); continue; }
    if (!inCycle(date) || date < r.lastDate) continue;
    bills.push({ id, ref: { templateTxId: tx.id }, label: r.description, detail: "conta mensal", amount: r.amount, date, kind: "conta" });
  }

  // Pagamentos agendados (não recorrentes, fora do cartão)
  const scheduledIds = new Set<string>();
  for (const t of data.transactions) {
    if (t.kind !== "expense" || t.payment_method === "credito" || t.recurrence !== "nenhuma" || !inCycle(t.occurred_on)) continue;
    if (t.created_at && t.occurred_on <= String(t.created_at).slice(0, 10)) continue; // gasto comum, não agendado
    scheduledIds.add(t.id);
    const id = `tx-${t.id}`;
    const paid = paidInfo(id);
    bills.push({ id, ref: { txId: t.id }, paid, label: t.description, detail: paid ? "pago" : "agendado", amount: paid ? paid.amount : num(t.amount), date: t.occurred_on, kind: "agendado" });
  }

  bills.sort((x, y) => (x.date ?? "9999").localeCompare(y.date ?? "9999"));
  const billsTotal = round2(bills.reduce((t, b) => t + b.amount, 0));
  const paidTotal = round2(bills.filter((b) => b.paid).reduce((t, b) => t + b.amount, 0));
  const catById = new Map(data.categories.map((c) => [c.id, c]));
  const isSaving = (catId: string | null) => { const c = catId ? catById.get(catId) : undefined; return !!c && isInvestmentCategory(c); };

  // Reserva e metas planejadas para o ciclo
  const reserveDetail = data.goals
    .filter((g) => g.status === "ativa")
    .map((g) => ({ name: g.name, amount: num(g.schedule?.[startKey] ?? g.monthly_contribution) }))
    .filter((g) => g.amount > 0);
  const reserve = round2(reserveDetail.reduce((t, g) => t + g.amount, 0));

  // Gastos já lançados dentro do ciclo que não são contas previstas
  const lastDay = today < end ? today : end;
  const inRange = data.transactions.filter((t) => t.kind === "expense" && t.occurred_on >= start && t.occurred_on < end);
  // Aportes feitos antes do salário cair (ciclo ainda por vir) contam para este salário
  const savingStart = savingsFrom && savingsFrom < start ? savingsFrom : start;
  const saved = round2(data.transactions.filter((t) => t.kind === "expense" && isSaving(t.category_id) && t.occurred_on >= savingStart && t.occurred_on < end).reduce((s, t) => s + num(t.amount), 0));
  const cycleTx = inRange.filter((t) => t.occurred_on <= lastDay && t.recurrence === "nenhuma" && !scheduledIds.has(t.id) && !isSaving(t.category_id));
  const spentOutsideCard = round2(cycleTx.filter((t) => t.payment_method !== "credito").reduce((s, t) => s + num(t.amount), 0));
  const cardSpending = round2(cycleTx.filter((t) => t.payment_method === "credito").reduce((s, t) => s + num(t.amount), 0));

  // Se já guardou mais do que o planejado, o excedente também sai do livre
  const free = round2(salary - billsTotal - Math.max(reserve, saved) - spentOutsideCard);
  const days = daysBetween(start, end);
  const remainingDays = today >= start ? Math.max(1, daysBetween(today, end)) : days;
  return {
    start, end, days, salary, salarySources, bills, billsTotal, paidTotal, key: startKey, saved, savingStart, reserve, reserveDetail, spentOutsideCard, cardSpending,
    free, perDay: round2(Math.max(0, free) / remainingDays), remainingDays,
  };
}

/**
 * Ciclo a mostrar: o atual (salário já recebido) ou, se o salário deste ciclo
 * caiu antes de o app começar a ser usado, o próximo.
 */
export function relevantCycle(data: FinancialData, a: Analysis, today: string, payments: BillPayment[] = []): { cycle: Cycle; upcoming: boolean } {
  const day = payDay(data);
  const cur = monthKey(today);
  const curStartKey = today >= payDate(cur, day) ? cur : addMonthsKey(cur, -1);
  const firstUse = [...data.transactions, ...data.incomes].map((r) => String((r as { created_at?: string }).created_at ?? "")).filter(Boolean).sort()[0]?.slice(0, 10) ?? today;
  const startedBeforeApp = payDate(curStartKey, day) < firstUse;
  const key = startedBeforeApp ? addMonthsKey(curStartKey, 1) : curStartKey;
  return { cycle: cycleFor(data, a, key, today, payments, key, startedBeforeApp ? payDate(curStartKey, day) : undefined), upcoming: startedBeforeApp };
}
