import { addMonthsKey, monthKey, monthsBetweenKeys } from "./dates";
import { Goal, num, round2 } from "./types";

export interface GoalAnalysis {
  goal: Goal;
  target: number;
  current: number;
  remaining: number;
  progress: number; // 0..1
  monthsLeft: number | null;
  requiredMonthly: number | null;
  planned: number;
  projectedMonths: number | null; // com o aporte planejado
  projectedDate: string | null;   // "YYYY-MM"
  onTrack: boolean;
  status: "concluida" | "no_ritmo" | "atrasada" | "sem_aporte" | "sem_prazo";
  suggestions: string[];
}

export function analyzeGoal(goal: Goal, today: string): GoalAnalysis {
  const target = num(goal.target_amount);
  const current = num(goal.current_amount);
  const remaining = round2(Math.max(0, target - current));
  const planned = num(goal.monthly_contribution);
  const cur = monthKey(today);
  const monthsLeft = goal.deadline ? Math.max(0, monthsBetweenKeys(cur, monthKey(goal.deadline))) : null;
  const requiredMonthly = monthsLeft !== null ? round2(monthsLeft > 0 ? remaining / monthsLeft : remaining) : null;
  const projectedMonths = remaining === 0 ? 0 : planned > 0 ? Math.ceil(remaining / planned) : null;
  const projectedDate = projectedMonths !== null ? addMonthsKey(cur, projectedMonths) : null;

  let status: GoalAnalysis["status"];
  if (remaining === 0 || goal.status === "concluida") status = "concluida";
  else if (planned <= 0) status = "sem_aporte";
  else if (requiredMonthly === null) status = "sem_prazo";
  else status = planned + 0.01 >= requiredMonthly ? "no_ritmo" : "atrasada";

  const suggestions: string[] = [];
  if (status === "atrasada" && requiredMonthly !== null && projectedMonths !== null) {
    suggestions.push(`Aumentar o aporte para ${fmt(requiredMonthly)}/mês para cumprir o prazo`);
    suggestions.push(`Ou estender o prazo para ${projectedDate} mantendo ${fmt(planned)}/mês`);
    if (monthsLeft && monthsLeft > 0) suggestions.push(`Ou reduzir o valor-alvo para ${fmt(current + planned * monthsLeft)}`);
  }
  if (status === "sem_aporte" && requiredMonthly) suggestions.push(`Defina um aporte de ${fmt(requiredMonthly)}/mês para cumprir o prazo`);

  return {
    goal, target, current, remaining, progress: target > 0 ? Math.min(1, current / target) : 0,
    monthsLeft, requiredMonthly, planned, projectedMonths, projectedDate,
    onTrack: status === "concluida" || status === "no_ritmo" || status === "sem_prazo",
    status, suggestions,
  };
}

export interface GoalsFeasibility {
  totalPlanned: number;
  totalRequired: number;
  capacity: number;
  feasible: boolean;
  message: string;
}

/** Avalia se o conjunto de metas cabe na capacidade de economia mensal. */
export function goalsFeasibility(analyses: GoalAnalysis[], savingsCapacity: number): GoalsFeasibility {
  const active = analyses.filter((a) => a.goal.status === "ativa" && a.status !== "concluida");
  const totalPlanned = round2(active.reduce((s, a) => s + a.planned, 0));
  const totalRequired = round2(active.reduce((s, a) => s + (a.requiredMonthly ?? a.planned), 0));
  const capacity = round2(Math.max(0, savingsCapacity));
  const need = Math.max(totalPlanned, totalRequired);
  const feasible = need <= capacity;
  let message: string;
  if (active.length === 0) message = "Nenhuma meta ativa.";
  else if (feasible) message = `As metas exigem ${fmt(need)}/mês e sua capacidade de economia é ${fmt(capacity)}/mês.`;
  else message = `As metas exigem ${fmt(need)}/mês, mas sua capacidade de economia é ${fmt(capacity)}/mês. Priorize as metas de prioridade alta e reavalie prazos.`;
  return { totalPlanned, totalRequired, capacity, feasible, message };
}

/** Projeção mensal do saldo acumulado da meta (para gráfico). */
export function goalProjection(a: GoalAnalysis, today: string, months = 24): { key: string; value: number }[] {
  const out: { key: string; value: number }[] = [];
  let v = a.current;
  const cur = monthKey(today);
  const horizon = Math.min(months, Math.max(6, (a.projectedMonths ?? 12) + 1));
  for (let i = 0; i <= horizon; i++) {
    out.push({ key: addMonthsKey(cur, i), value: round2(Math.min(v, a.target)) });
    v += a.planned;
  }
  return out;
}

const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
