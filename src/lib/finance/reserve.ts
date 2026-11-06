import { Snapshot } from "./snapshot";
import { round2 } from "./types";

export interface ReserveAnalysis {
  essentialMonthly: number;
  current: number;
  targets: { months: 3 | 6 | 12; amount: number; gap: number; monthsToReach: number | null }[];
  recommendedMonths: 3 | 6 | 12;
  recommended: number;
  gap: number;
  coverageMonths: number;
  monthlyContribution: number;
  monthsToRecommended: number | null;
  rationale: string;
}

/** Quantos meses de reserva recomendar conforme a estabilidade da renda. */
export function recommendedReserveMonths(s: Snapshot, dependents = 0): 3 | 6 | 12 {
  if (s.income.stableShare < 0.5) return 12;
  if (s.income.stableShare < 0.9 || dependents > 0) return 6;
  return 6; // padrão prudente mesmo para renda estável (CLT)
}

export function analyzeReserve(s: Snapshot, monthlyContribution: number, dependents = 0): ReserveAnalysis {
  const essentialMonthly = s.essentialMonthlyCost;
  const current = s.assets.reserve;
  const contrib = Math.max(0, monthlyContribution);
  const targets = ([3, 6, 12] as const).map((months) => {
    const amount = round2(essentialMonthly * months);
    const gap = round2(Math.max(0, amount - current));
    return { months, amount, gap, monthsToReach: gap === 0 ? 0 : contrib > 0 ? Math.ceil(gap / contrib) : null };
  });
  const recommendedMonths = recommendedReserveMonths(s, dependents);
  const rec = targets.find((t) => t.months === recommendedMonths)!;
  const rationale =
    recommendedMonths === 12
      ? "Sua renda é majoritariamente variável ou incerta; uma reserva de 12 meses oferece proteção adequada."
      : "Recomendamos 6 meses de despesas essenciais como proteção contra perda de renda e imprevistos.";
  return {
    essentialMonthly, current, targets, recommendedMonths, recommended: rec.amount, gap: rec.gap,
    coverageMonths: essentialMonthly > 0 ? round2(current / essentialMonthly) : 0,
    monthlyContribution: contrib, monthsToRecommended: rec.monthsToReach, rationale,
  };
}

export interface StressScenario {
  key: string;
  label: string;
  description: string;
  monthlyIncome: number;   // renda durante o cenário
  monthlyBurn: number;     // déficit mensal coberto pelo patrimônio líquido
  upfrontCost: number;
  survivalMonths: number | null; // null = sustentável indefinidamente
  verdict: string;
}

export interface StressParams {
  incomeReductionPct?: number; // 0..1
  medicalCost?: number;
  carRepairCost?: number;
  extraordinaryCost?: number;
}

/**
 * Por quanto tempo o padrão ESSENCIAL de vida se mantém em cada cenário,
 * usando reserva + dinheiro disponível (sem vender bens ilíquidos).
 */
export function stressTest(s: Snapshot, p: StressParams = {}): StressScenario[] {
  const essential = s.essentialMonthlyCost;
  const cushion = s.assets.liquid + s.assets.investments * 0.9; // investimentos com possível perda/IR
  const nonSalary = s.income.sources.filter((x) => x.type !== "salario").reduce((a, x) => a + x.monthly, 0);
  const reduction = p.incomeReductionPct ?? 0.3;

  const mk = (key: string, label: string, description: string, monthlyIncome: number, upfront: number): StressScenario => {
    const burn = round2(Math.max(0, essential - monthlyIncome));
    const after = cushion - upfront;
    let survival: number | null;
    if (after < 0) survival = 0;
    else if (burn === 0) survival = null;
    else survival = round2(after / burn);
    let verdict: string;
    if (survival === null) verdict = "Sustentável: a renda restante cobre as despesas essenciais.";
    else if (survival === 0) verdict = "Recursos líquidos insuficientes para absorver o impacto imediato.";
    else if (survival >= 6) verdict = "Boa proteção para este cenário.";
    else if (survival >= 3) verdict = "Proteção moderada — fortaleça a reserva.";
    else verdict = "Proteção frágil — este cenário exige ação rápida.";
    return { key, label, description, monthlyIncome: round2(monthlyIncome), monthlyBurn: burn, upfrontCost: round2(upfront), survivalMonths: survival, verdict };
  };

  return [
    mk("desemprego", "Perda de emprego", "Renda de salário zerada; mantêm-se outras fontes.", nonSalary, 0),
    mk("reducao", `Redução de renda (${Math.round(reduction * 100)}%)`, "Queda parcial da renda total.", s.income.monthlyNet * (1 - reduction), 0),
    mk("medica", "Despesa médica inesperada", "Gasto pontual com saúde; renda mantida.", s.income.monthlyNet, p.medicalCost ?? 5000),
    mk("veiculo", "Manutenção emergencial do veículo", "Reparo pontual; renda mantida.", s.income.monthlyNet, p.carRepairCost ?? 3000),
    mk("extra", "Despesa extraordinária + perda de emprego", "Pior caso: gasto pontual e salário zerado.", nonSalary, p.extraordinaryCost ?? 5000),
  ];
}
