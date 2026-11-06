// Cartões de crédito: a compra é CONSUMO na data da compra (relatórios de gastos),
// enquanto a fatura é uma OBRIGAÇÃO de caixa controlada separadamente aqui.
// O pagamento da fatura (kind = 'card_payment') reduz a obrigação e nunca gera despesa.

import { addMonthsKey, clampDate, monthKey, parseISO } from "./dates";
import { CreditCard, Transaction, num, round2 } from "./types";

export interface Statement {
  closeKey: string;   // "YYYY-MM" do fechamento
  closeDate: string;  // data de fechamento
  dueDate: string;    // data de vencimento
  total: number;
  paid: number;
  remaining: number;
  state: "fechada" | "aberta" | "futura";
  overdue: boolean;
}

export interface CardStatus {
  card: CreditCard;
  limit: number;
  used: number;        // saldo devedor total (inclui parcelas futuras)
  available: number;
  utilization: number; // 0..1
  openStatement: Statement | null;
  nextBill: Statement | null; // próxima fatura a pagar
  overdueAmount: number;
  futureInstallments: number; // parcelas em faturas após a aberta
  statements: Statement[];
}

/** Chave do mês de fechamento da fatura em que a compra entra. */
export function statementKeyForPurchase(purchaseISO: string, closingDay: number): string {
  const { y, m, d } = parseISO(purchaseISO);
  const key = `${y}-${String(m).padStart(2, "0")}`;
  // Compras no dia do fechamento ou depois entram na fatura seguinte.
  const closeDayThisMonth = Math.min(closingDay, new Date(Date.UTC(y, m, 0)).getUTCDate());
  return d >= closeDayThisMonth ? addMonthsKey(key, 1) : key;
}

export function statementDates(closeKey: string, closingDay: number, dueDay: number) {
  const [y, m] = closeKey.split("-").map(Number);
  const closeDate = clampDate(y, m, closingDay);
  const dueKey = dueDay > closingDay ? closeKey : addMonthsKey(closeKey, 1);
  const [dy, dm] = dueKey.split("-").map(Number);
  return { closeDate, dueDate: clampDate(dy, dm, dueDay) };
}

/** Divide um valor em n parcelas com centavos corretos (resto na última). */
export function splitInstallments(amount: number, n: number): number[] {
  const count = Math.max(1, Math.floor(n));
  const base = Math.floor((amount / count) * 100) / 100;
  const parts = Array.from({ length: count }, () => base);
  parts[count - 1] = round2(amount - base * (count - 1));
  return parts;
}

export function computeCardStatus(card: CreditCard, transactions: Transaction[], today: string): CardStatus {
  const amounts = new Map<string, number>();
  const add = (k: string, v: number) => amounts.set(k, round2((amounts.get(k) ?? 0) + v));

  for (const t of transactions) {
    if (t.card_id !== card.id || t.kind !== "expense" || t.payment_method !== "credito") continue;
    const first = statementKeyForPurchase(t.occurred_on, card.closing_day);
    splitInstallments(num(t.amount), t.installments || 1).forEach((v, i) => add(addMonthsKey(first, i), v));
  }

  const carried = num(card.carried_balance);
  if (carried > 0) {
    // Saldo anterior ao app: atribuído à última fatura fechada (vencimento próximo).
    add(addMonthsKey(statementKeyForPurchase(today, card.closing_day), -1), carried);
  }

  let payments = transactions
    .filter((t) => t.card_id === card.id && t.kind === "card_payment")
    .reduce((s, t) => s + num(t.amount), 0);

  const keys = [...amounts.keys()].sort();
  let openFound = false;
  const statements: Statement[] = keys.map((k) => {
    const total = amounts.get(k)!;
    const paid = round2(Math.min(total, payments));
    payments = round2(payments - paid);
    const { closeDate, dueDate } = statementDates(k, card.closing_day, card.due_day);
    let state: Statement["state"];
    if (closeDate <= today) state = "fechada";
    else if (!openFound) { state = "aberta"; openFound = true; }
    else state = "futura";
    const remaining = round2(total - paid);
    return { closeKey: k, closeDate, dueDate, total, paid, remaining, state, overdue: state === "fechada" && dueDate < today && remaining > 0.009 };
  });

  const limit = num(card.credit_limit);
  const used = round2(statements.reduce((s, x) => s + x.remaining, 0));
  const openStatement = statements.find((s) => s.state === "aberta") ?? null;
  const nextBill = statements.find((s) => s.remaining > 0.009 && !s.overdue) ?? null;
  const openIdx = openStatement ? statements.indexOf(openStatement) : statements.length;

  return {
    card,
    limit,
    used,
    available: round2(Math.max(0, limit - used)),
    utilization: limit > 0 ? used / limit : used > 0 ? 1 : 0,
    openStatement,
    nextBill,
    overdueAmount: round2(statements.filter((s) => s.overdue).reduce((s, x) => s + x.remaining, 0)),
    futureInstallments: round2(statements.slice(openIdx + 1).reduce((s, x) => s + x.remaining, 0)),
    statements,
  };
}

/** Valores a pagar de faturas por mês de vencimento ("YYYY-MM"). */
export function cardDueByMonth(statuses: CardStatus[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const st of statuses) {
    for (const s of st.statements) {
      if (s.remaining <= 0) continue;
      const k = monthKey(s.dueDate);
      map.set(k, round2((map.get(k) ?? 0) + s.remaining));
    }
  }
  return map;
}
