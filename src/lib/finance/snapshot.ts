// Fotografia financeira determinística: todos os indicadores derivam daqui.
// Princípios contábeis adotados:
//  • Patrimônio (estoque) ≠ renda (fluxo) ≠ saldo disponível (liquidez imediata).
//  • Renda recorrente vem do perfil; lançamentos "income" são rendas extras/eventuais.
//  • Compras no cartão contam como consumo na data da compra; a fatura é obrigação de caixa.
//  • Parcelas de empréstimos/financiamentos vêm do cadastro de Obrigações.

import { CardStatus, cardDueByMonth, computeCardStatus } from "./cards";
import { addMonthsKey, monthKey, monthLabel, remainingDaysInMonth } from "./dates";
import {
  Allocations, Bucket, Category, FinancialData, IncomeSource, Recurrence, Transaction, num, round2,
} from "./types";

export function monthlyEquivalent(amount: number, frequency: IncomeSource["frequency"] | Recurrence): number {
  switch (frequency) {
    case "mensal": return amount;
    case "quinzenal": return amount * 2;
    case "semanal": return (amount * 52) / 12;
    case "anual": return amount / 12;
    default: return 0; // eventual / nenhuma
  }
}

export interface MonthFlow {
  key: string;
  label: string;
  recurringIncome: number;
  extraIncome: number;
  income: number;
  expenses: number;
  essential: number;
  nonEssential: number;
  fixed: number;
  variable: number;
  debtPayments: number;
  invested: number; // aportes lançados na categoria Financeiro › Investimentos (não é consumo)
  savings: number;
  byBucket: Record<Bucket, number>;
  hasData: boolean;
}

export interface CategoryStat {
  id: string;
  name: string;
  group: string;
  bucket: Bucket;
  thisMonth: number;
  average: number;     // média dos meses completos de referência
  previous: number;    // mês anterior
  shareOfIncome: number;
  growth: number | null; // mês atual (até hoje) vs média de mês completo
  trend: number | null;  // mês anterior vs média de referência
}

export interface RecurringItem {
  description: string;
  categoryId: string | null;
  amount: number;
  monthly: number;
  recurrence: Recurrence;
  essential: boolean;
  lastDate: string;
  launchedThisMonth: boolean;
}

export interface FutureMonth {
  key: string;
  label: string;
  debts: number;
  cards: number;
  total: number;
  shareOfIncome: number;
}

export interface Snapshot {
  today: string;
  monthKey: string;
  dataQuality: {
    hasIncome: boolean;
    hasAssets: boolean;
    hasExpenses: boolean;
    hasDebtsInfo: boolean;
    completeMonths: number;
    missing: string[];
  };
  income: {
    monthlyNet: number;
    monthlyGross: number;
    stableShare: number;
    sources: { name: string; monthly: number; stability: string; type: string }[];
    expectedChanges: { name: string; pct: number; date: string | null }[];
  };
  assets: {
    total: number;
    liquid: number;      // conta + espécie + poupança (inclui reserva)
    available: number;   // conta + espécie, fora da reserva
    reserve: number;     // marcados como reserva de emergência
    investments: number;
    illiquid: number;    // imóveis, veículos, outros
    byType: Record<string, number>;
  };
  debts: {
    loansOutstanding: number;
    monthlyPayments: number;
    cardUsed: number;
    cardNextBills: number;
    cardOverdue: number;
    totalOutstanding: number;
    lateCount: number;
    highestMonthlyRate: number | null;
  };
  cards: CardStatus[];
  netWorth: number;
  month: MonthFlow;
  history: MonthFlow[];
  baseline: {
    expenses: number;
    essential: number;
    nonEssential: number;
    basis: "meses_completos" | "mes_parcial" | "sem_dados";
    months: number;
  };
  essentialMonthlyCost: number;
  recurring: RecurringItem[];
  fixedMonthly: number;
  pendingRecurringThisMonth: number;
  commitmentRatio: number;   // (fixos + dívidas) / renda
  debtRatio: number;         // parcelas de dívidas / renda
  savingsCapacity: number;   // renda − gastos de referência − dívidas
  savingsRate: number;
  plannedSavings: number;
  categories: CategoryStat[];
  futureCommitments: FutureMonth[];
  freeToSpend: {
    monthRemaining: number;
    perDay: number;
    cashFree: number;
    today: number;
    remainingDays: number;
  };
}

export function isInvestmentCategory(c: Pick<Category, "group_name" | "name">): boolean {
  return c.group_name === "Financeiro" && c.name === "Investimentos";
}

const emptyBuckets = (): Record<Bucket, number> => ({ essenciais: 0, pessoais: 0, lazer: 0, financeiro: 0 });

const RECURRING_SET: Recurrence[] = ["semanal", "mensal", "anual"];

export function buildSnapshot(data: FinancialData, today: string): Snapshot {
  const curKey = monthKey(today);
  const catById = new Map<string, Category>(data.categories.map((c) => [c.id, c]));

  // ---------- Renda ----------
  const activeIncomes = data.incomes.filter((i) => i.active);
  const sources = activeIncomes
    .map((i) => ({ name: i.name, monthly: round2(monthlyEquivalent(num(i.net_amount), i.frequency)), stability: i.stability, type: i.type }))
    .filter((s) => s.monthly > 0);
  const monthlyNet = round2(sources.reduce((s, x) => s + x.monthly, 0));
  const monthlyGross = round2(activeIncomes.reduce((s, i) => s + monthlyEquivalent(num(i.gross_amount) || num(i.net_amount), i.frequency), 0));
  const stableIncome = sources.filter((s) => s.stability === "estavel").reduce((s, x) => s + x.monthly, 0);
  const expectedChanges = activeIncomes
    .filter((i) => num(i.expected_change_pct) !== 0)
    .map((i) => ({ name: i.name, pct: num(i.expected_change_pct), date: i.expected_change_date }));

  // ---------- Patrimônio ----------
  const byType: Record<string, number> = {};
  let liquid = 0, available = 0, reserve = 0, investments = 0, illiquid = 0, totalAssets = 0;
  for (const a of data.assets) {
    const v = num(a.value);
    totalAssets += v;
    byType[a.type] = round2((byType[a.type] ?? 0) + v);
    const isCash = a.type === "conta" || a.type === "especie" || a.type === "poupanca";
    // A reserva conta como liquidez qualquer que seja o tipo (ex.: CDB de liquidez diária)
    // e não é somada também em "investimentos", evitando contagem dupla.
    if (a.is_emergency_reserve) reserve += v;
    if (isCash || a.is_emergency_reserve) liquid += v;
    if ((a.type === "conta" || a.type === "especie") && !a.is_emergency_reserve) available += v;
    if (a.type === "investimento" && !a.is_emergency_reserve) investments += v;
    if (a.type === "imovel" || a.type === "veiculo" || a.type === "outro") illiquid += v;
  }

  // ---------- Dívidas e cartões ----------
  const cards = data.cards.map((c) => computeCardStatus(c, data.transactions, today));
  const loansOutstanding = round2(data.debts.reduce((s, d) => s + num(d.outstanding_balance), 0));
  const monthlyPayments = round2(data.debts.reduce((s, d) => s + num(d.monthly_payment), 0));
  const cardUsed = round2(cards.reduce((s, c) => s + c.used, 0));
  const cardNextBills = round2(cards.reduce((s, c) => s + (c.nextBill?.remaining ?? 0), 0));
  const cardOverdue = round2(cards.reduce((s, c) => s + c.overdueAmount, 0));
  const rates = data.debts.map((d) => num(d.interest_rate_monthly)).filter((r) => r > 0);
  const totalOutstanding = round2(loansOutstanding + cardUsed);
  const netWorth = round2(totalAssets - totalOutstanding);

  // ---------- Fluxos mensais ----------
  const flows = new Map<string, MonthFlow>();
  const flowFor = (key: string): MonthFlow => {
    let f = flows.get(key);
    if (!f) {
      f = {
        key, label: monthLabel(key), recurringIncome: monthlyNet, extraIncome: 0, income: 0, expenses: 0,
        essential: 0, nonEssential: 0, fixed: 0, variable: 0, debtPayments: monthlyPayments, invested: 0, savings: 0,
        byBucket: emptyBuckets(), hasData: false,
      };
      flows.set(key, f);
    }
    return f;
  };
  const catMonth = new Map<string, Map<string, number>>(); // categoria → mês → valor

  for (const t of data.transactions) {
    const key = monthKey(t.occurred_on);
    if (key > curKey) continue; // lançamentos futuros não entram no realizado
    const v = num(t.amount);
    if (t.kind === "income") {
      const f = flowFor(key);
      f.extraIncome += v;
      f.hasData = true;
    } else if (t.kind === "expense") {
      const f = flowFor(key);
      f.hasData = true;
      const cat = t.category_id ? catById.get(t.category_id) : undefined;
      if (cat && isInvestmentCategory(cat)) {
        f.invested += v;
        continue;
      }
      f.expenses += v;
      if (t.is_essential) f.essential += v; else f.nonEssential += v;
      if (RECURRING_SET.includes(t.recurrence)) f.fixed += v; else f.variable += v;
      f.byBucket[cat?.bucket ?? (t.is_essential ? "essenciais" : "pessoais")] += v;
      const cid = t.category_id ?? "sem_categoria";
      if (!catMonth.has(cid)) catMonth.set(cid, new Map());
      const m = catMonth.get(cid)!;
      m.set(key, (m.get(key) ?? 0) + v);
    }
    // card_payment: apenas caixa — não é consumo.
  }

  const history: MonthFlow[] = [];
  for (let i = 5; i >= 0; i--) history.push(flowFor(addMonthsKey(curKey, -i)));
  for (const f of history) {
    for (const k of ["extraIncome", "expenses", "essential", "nonEssential", "fixed", "variable", "invested"] as const) f[k] = round2(f[k]);
    (Object.keys(f.byBucket) as Bucket[]).forEach((b) => (f.byBucket[b] = round2(f.byBucket[b])));
    f.income = round2(f.recurringIncome + f.extraIncome);
    f.savings = round2(f.income - f.expenses - f.debtPayments);
  }
  const month = history[history.length - 1];

  // Referência: até 3 meses completos anteriores com dados
  const complete = history.slice(0, -1).filter((f) => f.hasData).slice(-3);
  const avg = (sel: (f: MonthFlow) => number) =>
    complete.length ? round2(complete.reduce((s, f) => s + sel(f), 0) / complete.length) : 0;

  // ---------- Recorrências ----------
  const recMap = new Map<string, RecurringItem>();
  for (const t of data.transactions) {
    if (t.kind !== "expense" || !RECURRING_SET.includes(t.recurrence)) continue;
    const tc = t.category_id ? catById.get(t.category_id) : undefined;
    if (tc && isInvestmentCategory(tc)) continue;
    const k = `${t.description.trim().toLowerCase()}|${t.category_id ?? ""}`;
    const prev = recMap.get(k);
    if (!prev || t.occurred_on > prev.lastDate) {
      const amount = num(t.amount);
      recMap.set(k, {
        description: t.description, categoryId: t.category_id, amount,
        monthly: round2(monthlyEquivalent(amount, t.recurrence)), recurrence: t.recurrence,
        essential: t.is_essential, lastDate: t.occurred_on, launchedThisMonth: false,
      });
    }
  }
  const recurring = [...recMap.values()];
  for (const r of recurring) {
    r.launchedThisMonth = r.recurrence !== "mensal" || monthKey(r.lastDate) >= curKey;
  }
  const fixedMonthly = round2(recurring.reduce((s, r) => s + r.monthly, 0));
  const pendingRecurringThisMonth = round2(recurring.filter((r) => !r.launchedThisMonth).reduce((s, r) => s + r.amount, 0));

  let baseline: Snapshot["baseline"];
  if (complete.length) {
    baseline = {
      expenses: avg((f) => f.expenses), essential: avg((f) => f.essential), nonEssential: avg((f) => f.nonEssential),
      basis: "meses_completos", months: complete.length,
    };
  } else if (month.hasData || recurring.length) {
    // Mês parcial: realizado até agora + recorrências ainda não lançadas
    const pendingEssential = recurring.filter((r) => !r.launchedThisMonth && r.essential).reduce((s, r) => s + r.amount, 0);
    baseline = {
      expenses: round2(month.expenses + pendingRecurringThisMonth),
      essential: round2(month.essential + pendingEssential),
      nonEssential: round2(month.nonEssential + pendingRecurringThisMonth - pendingEssential),
      basis: "mes_parcial", months: 0,
    };
  } else {
    baseline = { expenses: 0, essential: 0, nonEssential: 0, basis: "sem_dados", months: 0 };
  }

  const essentialMonthlyCost = round2(baseline.essential + monthlyPayments);
  const savingsCapacity = round2(monthlyNet - baseline.expenses - monthlyPayments);

  // ---------- Categorias ----------
  const prevKey = addMonthsKey(curKey, -1);
  const categories: CategoryStat[] = [];
  for (const [cid, m] of catMonth) {
    const cat = catById.get(cid);
    const thisMonth = round2(m.get(curKey) ?? 0);
    const average = complete.length ? round2(complete.reduce((s, f) => s + (m.get(f.key) ?? 0), 0) / complete.length) : 0;
    if (thisMonth === 0 && average === 0) continue;
    // Comparamos o realizado até hoje com a média do mês COMPLETO: só sinaliza
    // crescimento quando o mês já superou a média, sem falsos alertas para contas
    // pagas no início do mês.
    categories.push({
      id: cid,
      name: cat?.name ?? "Sem categoria",
      group: cat?.group_name ?? "Outros",
      bucket: cat?.bucket ?? "pessoais",
      thisMonth,
      average,
      previous: round2(m.get(prevKey) ?? 0),
      shareOfIncome: monthlyNet > 0 ? (complete.length ? average : thisMonth) / monthlyNet : 0,
      growth: average > 0 ? (thisMonth - average) / average : null,
      trend: average > 0 ? (round2(m.get(prevKey) ?? 0) - average) / average : null,
    });
  }
  categories.sort((a, b) => b.thisMonth - a.thisMonth || b.average - a.average);

  // ---------- Compromissos futuros (12 meses) ----------
  const cardDue = cardDueByMonth(cards);
  const futureCommitments: FutureMonth[] = [];
  for (let i = 0; i < 12; i++) {
    const key = addMonthsKey(curKey, i);
    const debts = round2(data.debts.reduce((s, d) => {
      const n = d.remaining_installments;
      return s + (n === null || n === undefined || i < n ? num(d.monthly_payment) : 0);
    }, 0));
    const cardsDue = round2(cardDue.get(key) ?? 0) + (i === 0 ? cardOverdue : 0);
    const total = round2(debts + cardsDue);
    futureCommitments.push({ key, label: monthLabel(key), debts, cards: round2(cardsDue), total, shareOfIncome: monthlyNet > 0 ? total / monthlyNet : 0 });
  }

  // ---------- Poupança planejada ----------
  const plan: Allocations | undefined = data.budgetPlan?.allocations;
  const plannedSavings = round2(
    plan
      ? num(plan.reserva) + num(plan.investimentos) + num(plan.metas_curto) + num(plan.metas_longo)
      : data.goals.filter((g) => g.status === "ativa").reduce((s, g) => s + num(g.monthly_contribution), 0),
  );

  // ---------- Livre para gastar ----------
  const remainingDays = remainingDaysInMonth(today);
  const monthRemaining = round2(
    month.income - month.expenses - pendingRecurringThisMonth - monthlyPayments - plannedSavings,
  );
  const perDay = round2(Math.max(0, monthRemaining) / remainingDays);
  // Caixa livre: dinheiro disponível menos faturas e parcelas que vencem neste mês
  const dueThisMonth = futureCommitments[0]?.total ?? 0;
  const cashFree = round2(available - dueThisMonth);
  const todayFree = round2(Math.max(0, Math.min(perDay, cashFree > 0 ? cashFree : 0)));

  // ---------- Qualidade dos dados ----------
  const missing: string[] = [];
  if (monthlyNet <= 0) missing.push("renda mensal líquida");
  if (data.assets.length === 0) missing.push("saldos e patrimônio");
  if (!data.transactions.some((t) => t.kind === "expense")) missing.push("despesas registradas");
  if (data.goals.length === 0) missing.push("metas financeiras");

  return {
    today,
    monthKey: curKey,
    dataQuality: {
      hasIncome: monthlyNet > 0,
      hasAssets: data.assets.length > 0,
      hasExpenses: data.transactions.some((t) => t.kind === "expense"),
      hasDebtsInfo: data.debts.length > 0 || data.cards.length > 0,
      completeMonths: complete.length,
      missing,
    },
    income: { monthlyNet, monthlyGross, stableShare: monthlyNet > 0 ? stableIncome / monthlyNet : 0, sources, expectedChanges },
    assets: {
      total: round2(totalAssets), liquid: round2(liquid), available: round2(available), reserve: round2(reserve),
      investments: round2(investments), illiquid: round2(illiquid), byType,
    },
    debts: {
      loansOutstanding, monthlyPayments, cardUsed, cardNextBills, cardOverdue, totalOutstanding,
      lateCount: data.debts.filter((d) => d.is_late).length + cards.filter((c) => c.overdueAmount > 0).length,
      highestMonthlyRate: rates.length ? Math.max(...rates) : null,
    },
    cards,
    netWorth,
    month,
    history,
    baseline,
    essentialMonthlyCost,
    recurring,
    fixedMonthly,
    pendingRecurringThisMonth,
    commitmentRatio: monthlyNet > 0 ? (fixedMonthly + monthlyPayments) / monthlyNet : 0,
    debtRatio: monthlyNet > 0 ? monthlyPayments / monthlyNet : 0,
    savingsCapacity,
    savingsRate: monthlyNet > 0 ? savingsCapacity / monthlyNet : 0,
    plannedSavings,
    categories,
    futureCommitments,
    freeToSpend: { monthRemaining, perDay, cashFree, today: todayFree, remainingDays },
  };
}

export function transactionsOfMonth(txs: Transaction[], key: string): Transaction[] {
  return txs.filter((t) => monthKey(t.occurred_on) === key);
}
