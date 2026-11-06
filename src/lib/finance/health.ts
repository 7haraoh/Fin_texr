// Classificação de saúde financeira (0–100) combinando múltiplos fatores —
// não apenas saldo bancário.

import { Snapshot } from "./snapshot";
import { GoalAnalysis } from "./goals";

export type HealthLevel = "excelente" | "saudavel" | "atencao" | "risco" | "critico";

export interface HealthComponent {
  key: string;
  label: string;
  score: number; // 0..1
  weight: number;
  detail: string;
}

export interface HealthResult {
  score: number | null; // null quando não há dados mínimos
  level: HealthLevel | null;
  label: string;
  components: HealthComponent[];
  insufficient: string[];
}

export const HEALTH_LABELS: Record<HealthLevel, string> = {
  excelente: "Excelente",
  saudavel: "Saudável",
  atencao: "Atenção",
  risco: "Risco",
  critico: "Crítico",
};

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
/** Interpolação linear: v ≤ bad → 0, v ≥ good → 1 (ou inverso se good < bad). */
const scale = (v: number, bad: number, good: number) => clamp01((v - bad) / (good - bad));

export function levelFromScore(score: number): HealthLevel {
  if (score >= 80) return "excelente";
  if (score >= 65) return "saudavel";
  if (score >= 45) return "atencao";
  if (score >= 25) return "risco";
  return "critico";
}

export function computeHealth(s: Snapshot, goals: GoalAnalysis[]): HealthResult {
  const insufficient: string[] = [];
  if (!s.dataQuality.hasIncome) insufficient.push("Cadastre sua renda mensal líquida");
  if (!s.dataQuality.hasExpenses) insufficient.push("Registre suas despesas");
  if (insufficient.length) {
    return { score: null, level: null, label: "Dados insuficientes", components: [], insufficient };
  }

  const income = s.income.monthlyNet;
  const components: HealthComponent[] = [];

  // 1. Taxa de poupança (capacidade de economia)
  components.push({
    key: "poupanca", label: "Capacidade de economia", weight: 25,
    score: scale(s.savingsRate, -0.05, 0.25),
    detail: `${(s.savingsRate * 100).toFixed(1)}% da renda sobra após gastos e dívidas`,
  });

  // 2. Endividamento: parcelas / renda e uso de cartões
  const debtLoad = s.debtRatio + (s.futureCommitments[1]?.cards ?? 0) / income * 0.5;
  let debtScore = scale(debtLoad, 0.45, 0.05);
  if (s.debts.lateCount > 0) debtScore *= 0.4;
  components.push({
    key: "dividas", label: "Endividamento", weight: 25, score: debtScore,
    detail: `${(s.debtRatio * 100).toFixed(1)}% da renda em parcelas${s.debts.lateCount ? ` · ${s.debts.lateCount} em atraso` : ""}`,
  });

  // 3. Reserva de emergência (meses de despesas essenciais cobertos)
  const coverage = s.essentialMonthlyCost > 0 ? s.assets.reserve / s.essentialMonthlyCost : 0;
  components.push({
    key: "reserva", label: "Reserva de emergência", weight: 20, score: scale(coverage, 0, 6),
    detail: `${coverage.toFixed(1)} meses de despesas essenciais`,
  });

  // 4. Liquidez: dinheiro disponível vs compromissos do mês
  const due = s.futureCommitments[0]?.total ?? 0;
  const liquidityRatio = due + s.baseline.essential > 0 ? s.assets.liquid / (due + s.baseline.essential) : 1;
  components.push({
    key: "liquidez", label: "Liquidez", weight: 15, score: scale(liquidityRatio, 0.3, 2),
    detail: `Dinheiro líquido cobre ${liquidityRatio.toFixed(1)}× os compromissos do mês`,
  });

  // 5. Comprometimento da renda com fixos
  components.push({
    key: "comprometimento", label: "Comprometimento da renda", weight: 10,
    score: scale(s.commitmentRatio, 0.85, 0.45),
    detail: `${(s.commitmentRatio * 100).toFixed(1)}% da renda em gastos fixos e parcelas`,
  });

  // 6. Metas no prazo
  const active = goals.filter((g) => g.goal.status === "ativa");
  if (active.length) {
    const onTrack = active.filter((g) => g.onTrack).length / active.length;
    components.push({
      key: "metas", label: "Metas", weight: 5, score: onTrack,
      detail: `${active.filter((g) => g.onTrack).length} de ${active.length} metas no ritmo`,
    });
  }

  const totalWeight = components.reduce((s2, c) => s2 + c.weight, 0);
  let score = Math.round((components.reduce((s2, c) => s2 + c.score * c.weight, 0) / totalWeight) * 100);
  // Gasto acima da renda limita a classificação a "Risco" no máximo
  if (s.savingsCapacity < 0) score = Math.min(score, 44);
  if (s.debts.lateCount > 0) score = Math.min(score, 54);
  const level = levelFromScore(score);
  return { score, level, label: HEALTH_LABELS[level], components, insufficient };
}
