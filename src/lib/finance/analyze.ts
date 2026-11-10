// Ponto único de entrada: dados → análise completa e determinística.

import { budgetStatus, categoryLimitStatus, suggestBudget } from "./budget";
import { analyzeGoal, goalsFeasibility } from "./goals";
import { computeHealth } from "./health";
import { generateInsights } from "./insights";
import { analyzeReserve } from "./reserve";
import { buildSnapshot } from "./snapshot";
import { FinancialData, num } from "./types";

export function analyze(data: FinancialData, today: string) {
  const snapshot = buildSnapshot(data, today);
  const goals = data.goals.map((g) => analyzeGoal(g, today));
  const reserveGoal = data.goals.find((g) => g.type === "reserva" && g.status === "ativa");
  const planReserve = num(data.budgetPlan?.allocations?.reserva);
  const reserveContribution = reserveGoal ? analyzeGoal(reserveGoal, today).planned : planReserve || Math.max(0, snapshot.savingsCapacity * 0.5);
  const lifestyle = data.profile?.lifestyle ?? {};
  const reserve = analyzeReserve(snapshot, reserveContribution, lifestyle.dependents ?? 0);
  const suggestion = suggestBudget(snapshot, goals, reserve, lifestyle);
  const allocations = data.budgetPlan?.allocations ?? null;
  const budget = allocations ? budgetStatus(snapshot, allocations) : null;
  const limits = categoryLimitStatus(data.categoryLimits, data.categories, data.transactions, snapshot.monthKey);
  const health = computeHealth(snapshot, goals);
  const feasibility = goalsFeasibility(goals, snapshot.savingsCapacity);
  const insights = generateInsights({ s: snapshot, reserve, goals, budget, limits, transactions: data.transactions });
  return { snapshot, goals, reserve, suggestion, budget, limits, health, feasibility, insights };
}

export type Analysis = ReturnType<typeof analyze>;
