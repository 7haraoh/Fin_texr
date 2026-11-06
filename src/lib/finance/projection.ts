// Projeções de cenários. Todos os resultados aqui são ESTIMATIVAS, calculadas
// a partir de premissas explícitas — nunca valores registrados.

import { addMonthsKey, monthKey, monthLabel, monthsBetweenKeys } from "./dates";
import { Snapshot } from "./snapshot";
import { Debt, IncomeSource, num, round2 } from "./types";

export type ScenarioKey = "conservador" | "realista" | "otimista";

export interface ScenarioAssumptions {
  incomeGrowthYear: number;  // crescimento nominal da renda a.a.
  inflationYear: number;     // crescimento das despesas a.a.
  returnYear: number;        // rentabilidade nominal da carteira líquida a.a.
  applyExpectedChanges: boolean;
}

export const DEFAULT_SCENARIOS: Record<ScenarioKey, ScenarioAssumptions> = {
  conservador: { incomeGrowthYear: 0.03, inflationYear: 0.055, returnYear: 0.09, applyExpectedChanges: false },
  realista: { incomeGrowthYear: 0.05, inflationYear: 0.045, returnYear: 0.105, applyExpectedChanges: true },
  otimista: { incomeGrowthYear: 0.08, inflationYear: 0.04, returnYear: 0.12, applyExpectedChanges: true },
};

export const SCENARIO_LABELS: Record<ScenarioKey, string> = {
  conservador: "Conservador", realista: "Realista", otimista: "Otimista",
};

export interface ProjectionPoint {
  key: string;
  label: string;
  income: number;
  expenses: number;
  debtPayments: number;
  savings: number;
  liquidPool: number;
  debt: number;
  netWorth: number;
}

const monthly = (yearRate: number) => Math.pow(1 + yearRate, 1 / 12) - 1;

export function project(
  s: Snapshot, debts: Debt[], incomes: IncomeSource[], a: ScenarioAssumptions, months = 60,
): ProjectionPoint[] {
  const gI = monthly(a.incomeGrowthYear), gE = monthly(a.inflationYear), r = monthly(a.returnYear);
  const baseExpenses = s.baseline.expenses;
  let pool = s.assets.liquid + s.assets.investments - s.debts.cardUsed;
  const illiquid = s.assets.illiquid;
  const debtState = debts.map((d) => ({
    balance: num(d.outstanding_balance),
    payment: num(d.monthly_payment),
    left: d.remaining_installments ?? (num(d.monthly_payment) > 0 ? Math.ceil(num(d.outstanding_balance) / num(d.monthly_payment)) : 0),
  }));
  const changes = a.applyExpectedChanges
    ? incomes.filter((i) => i.active && num(i.expected_change_pct) !== 0).map((i) => ({
        at: i.expected_change_date ? monthsBetweenKeys(s.monthKey, monthKey(i.expected_change_date)) : 12,
        delta: (num(i.net_amount) * num(i.expected_change_pct)) / 100,
      }))
    : [];

  const out: ProjectionPoint[] = [];
  const debtTotal = () => debtState.reduce((t, d) => t + d.balance, 0);
  out.push({
    key: s.monthKey, label: monthLabel(s.monthKey), income: s.income.monthlyNet, expenses: baseExpenses,
    debtPayments: s.debts.monthlyPayments, savings: s.savingsCapacity, liquidPool: round2(pool),
    debt: round2(debtTotal()), netWorth: s.netWorth,
  });

  for (let t = 1; t <= months; t++) {
    let income = s.income.monthlyNet * Math.pow(1 + gI, t);
    for (const c of changes) if (t >= c.at) income += c.delta * Math.pow(1 + gI, t - c.at);
    const expenses = baseExpenses * Math.pow(1 + gE, t);
    let debtPayments = 0;
    for (const d of debtState) {
      if (d.left > 0 && d.payment > 0) {
        debtPayments += d.payment;
        d.left -= 1;
        // Amortização aproximada: saldo reduz proporcionalmente às parcelas restantes
        d.balance = d.left > 0 ? Math.max(0, d.balance - d.balance / (d.left + 1)) : 0;
      }
    }
    const savings = income - expenses - debtPayments;
    pool = pool * (1 + r) + savings;
    const debt = debtTotal();
    const key = addMonthsKey(s.monthKey, t);
    out.push({
      key, label: monthLabel(key), income: round2(income), expenses: round2(expenses), debtPayments: round2(debtPayments),
      savings: round2(savings), liquidPool: round2(pool), debt: round2(debt), netWorth: round2(pool + illiquid - debt),
    });
  }
  return out;
}
