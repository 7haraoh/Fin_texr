// Simulador de compras: avaliação determinística, com motivos explícitos.

import { Snapshot } from "./snapshot";
import { ReserveAnalysis } from "./reserve";
import { round2 } from "./types";

export type PurchaseMethod = "avista" | "credito_parcelado" | "financiado";
export type PurchaseNeed = "necessidade" | "melhoria" | "desejo";

export interface PurchaseInput {
  item: string;
  price: number;
  method: PurchaseMethod;
  installments: number;
  monthlyInterestPct: number;   // juros do parcelamento (% a.m.), 0 = sem juros
  cashDiscountPct: number;      // desconto à vista (%)
  need: PurchaseNeed;
}

export type PurchaseVerdict = "confortavel" | "planejamento" | "compromete_metas" | "nao_recomendada";

export const VERDICT_LABELS: Record<PurchaseVerdict, string> = {
  confortavel: "Compra financeiramente confortável",
  planejamento: "Compra possível, mas exige planejamento",
  compromete_metas: "Compra que compromete metas",
  nao_recomendada: "Compra não recomendada no cenário atual",
};

export interface PurchaseEvaluation {
  verdict: PurchaseVerdict;
  label: string;
  reasons: string[];
  alternatives: string[];
  metrics: {
    upfront: number;
    installment: number;
    totalCost: number;
    shareOfIncome: number;          // parcela / renda
    newCommitmentRatio: number;     // (fixos+dívidas+parcela)/renda
    savingsAfter: number;           // capacidade de economia após a parcela
    cashAfter: number;              // disponível após entrada e compromissos do mês
    monthsOfSavings: number | null; // quantos meses de economia a compra representa
  };
}

/** Prestação pela tabela Price. */
export function priceInstallment(principal: number, n: number, monthlyRate: number): number {
  if (n <= 1) return principal;
  if (monthlyRate <= 0) return principal / n;
  const i = monthlyRate;
  return (principal * i) / (1 - Math.pow(1 + i, -n));
}

export interface CashVsInstallments {
  cashPrice: number;
  installment: number;
  totalInstallments: number;
  presentValueInstallments: number; // descontado pelo rendimento da aplicação
  opportunityGain: number;          // rendimento obtido mantendo o dinheiro aplicado
  bestOption: "avista" | "parcelado" | "indiferente";
  explanation: string;
}

/**
 * Compara pagar à vista (com desconto) vs parcelado, considerando o custo de
 * oportunidade: o dinheiro não gasto à vista poderia render `yieldMonthlyPct` ao mês.
 */
export function compareCashVsInstallments(
  price: number, cashDiscountPct: number, installments: number, monthlyInterestPct: number, yieldMonthlyPct: number,
): CashVsInstallments {
  const cashPrice = round2(price * (1 - cashDiscountPct / 100));
  const inst = priceInstallment(price, installments, monthlyInterestPct / 100);
  const total = round2(inst * installments);
  const y = yieldMonthlyPct / 100;
  let pv = 0;
  for (let k = 1; k <= installments; k++) pv += inst / Math.pow(1 + y, k);
  pv = round2(pv);
  const opportunityGain = round2(total - pv);
  const diff = pv - cashPrice;
  let best: CashVsInstallments["bestOption"];
  if (Math.abs(diff) < price * 0.005) best = "indiferente";
  else best = diff > 0 ? "avista" : "parcelado";
  const explanation =
    best === "avista"
      ? `Pagar à vista custa ${fmt(cashPrice)}; o parcelado equivale a ${fmt(pv)} em valor presente. À vista economiza ${fmt(diff)} — desde que não comprometa sua reserva.`
      : best === "parcelado"
        ? `O parcelado equivale a ${fmt(pv)} em valor presente, abaixo do preço à vista de ${fmt(cashPrice)}. Parcelar sem juros e manter o dinheiro aplicado rende cerca de ${fmt(-diff)} — desde que as parcelas caibam no orçamento.`
        : "As duas opções têm custo praticamente equivalente; priorize a que preserva sua liquidez e não aumenta o endividamento.";
  return { cashPrice, installment: round2(inst), totalInstallments: total, presentValueInstallments: pv, opportunityGain, bestOption: best, explanation };
}

export function evaluatePurchase(s: Snapshot, reserve: ReserveAnalysis, p: PurchaseInput): PurchaseEvaluation {
  const reasons: string[] = [];
  const alternatives: string[] = [];
  const income = s.income.monthlyNet;
  const isInstallment = p.method !== "avista" && p.installments > 1;
  const upfront = isInstallment ? 0 : round2(p.price * (1 - p.cashDiscountPct / 100));
  const installment = isInstallment ? round2(priceInstallment(p.price, p.installments, p.monthlyInterestPct / 100)) : 0;
  const totalCost = isInstallment ? round2(installment * p.installments) : upfront;
  const dueThisMonth = s.futureCommitments[0]?.total ?? 0;
  const cashAfter = round2(s.assets.available - dueThisMonth - upfront);
  const savingsAfter = round2(s.savingsCapacity - installment);
  const newCommitmentRatio = income > 0 ? (s.fixedMonthly + s.debts.monthlyPayments + installment) / income : Infinity;
  const shareOfIncome = income > 0 ? installment / income : Infinity;
  const monthsOfSavings = s.savingsCapacity > 0 ? round2(totalCost / s.savingsCapacity) : null;

  const metrics = { upfront, installment, totalCost, shareOfIncome, newCommitmentRatio, savingsAfter, cashAfter, monthsOfSavings };

  if (income <= 0) {
    return {
      verdict: "nao_recomendada", label: "Dados insuficientes",
      reasons: ["Não há renda mensal cadastrada; não é possível avaliar a compra com segurança."],
      alternatives: ["Cadastre sua renda líquida no Perfil Financeiro e repita a simulação."], metrics,
    };
  }

  let severity = 0; // 0 confortável, 1 planejamento, 2 compromete metas, 3 não recomendada
  const bump = (lvl: number, reason: string) => { severity = Math.max(severity, lvl); reasons.push(reason); };

  // Liquidez imediata
  if (!isInstallment) {
    if (cashAfter < 0) {
      const usesReserve = cashAfter + s.assets.reserve >= 0;
      bump(3, usesReserve
        ? `O pagamento à vista exigiria usar ${fmt(-cashAfter)} da reserva de emergência.`
        : `Não há saldo disponível suficiente: faltariam ${fmt(-cashAfter)} após os compromissos do mês.`);
    } else if (cashAfter < s.baseline.essential) {
      bump(1, `Após a compra restariam ${fmt(cashAfter)} disponíveis, menos que um mês de despesas essenciais (${fmt(s.baseline.essential)}).`);
    } else {
      reasons.push(`Após a compra e os compromissos do mês ainda restariam ${fmt(cashAfter)} disponíveis.`);
    }
  }

  // Fluxo mensal
  if (isInstallment) {
    if (savingsAfter < 0) bump(3, `A parcela de ${fmt(installment)} deixaria seu orçamento mensal negativo em ${fmt(-savingsAfter)}.`);
    else if (shareOfIncome > 0.15) bump(2, `A parcela consome ${pctTxt(shareOfIncome)} da renda líquida — acima do limite prudente de 15% para uma única compra.`);
    else if (shareOfIncome > 0.07) bump(1, `A parcela representa ${pctTxt(shareOfIncome)} da renda mensal.`);
    else reasons.push(`A parcela representa ${pctTxt(shareOfIncome)} da renda — impacto mensal baixo.`);

    if (newCommitmentRatio > 0.7) bump(3, `O comprometimento da renda com fixos e parcelas subiria para ${pctTxt(newCommitmentRatio)}.`);
    else if (newCommitmentRatio > 0.5) bump(2, `O comprometimento da renda subiria para ${pctTxt(newCommitmentRatio)}.`);

    const next = s.futureCommitments.slice(0, Math.min(12, p.installments)).map((m) => m.shareOfIncome + shareOfIncome);
    const peak = next.length ? Math.max(...next) : 0;
    if (peak > 0.4) bump(2, `Somadas às faturas e parcelas já existentes, as obrigações chegam a ${pctTxt(peak)} da renda em algum mês do período.`);
    if (p.monthlyInterestPct > 0) {
      bump(Math.max(1, severity), `O parcelamento com juros de ${p.monthlyInterestPct.toLocaleString("pt-BR")}% a.m. eleva o custo total para ${fmt(totalCost)} (+${fmt(totalCost - p.price)}).`);
      alternatives.push("Juntar o valor por alguns meses e comprar à vista evita juros.");
    }
  }

  // Reserva e metas
  if (reserve.coverageMonths < 3 && p.need !== "necessidade") {
    bump(Math.max(2, severity === 3 ? 3 : 2), `Sua reserva cobre só ${reserve.coverageMonths.toFixed(1)} meses de despesas essenciais; uma compra não essencial agora atrasa sua proteção financeira.`);
  }
  if (s.plannedSavings > 0 && monthsOfSavings !== null && monthsOfSavings > 3 && p.need === "desejo") {
    bump(2, `O custo total equivale a ${monthsOfSavings.toLocaleString("pt-BR")} meses da sua capacidade de economia, competindo com suas metas.`);
  }
  if (s.debts.lateCount > 0) bump(3, "Há dívidas ou faturas em atraso; regularize-as antes de assumir novos gastos.");
  if (s.savingsCapacity <= 0) bump(3, "Seus gastos atuais já igualam ou superam a renda; novas compras aumentam o risco de endividamento.");

  if (p.need === "necessidade" && severity >= 2) {
    alternatives.push("Por ser uma necessidade, avalie uma opção mais barata que resolva o problema.");
  }
  if (p.need === "desejo" && severity >= 1 && s.savingsCapacity > 0) {
    const months = Math.ceil(totalCost / (s.savingsCapacity * 0.3));
    alternatives.push(`Criar uma meta separando 30% da sua economia mensal (${fmt(s.savingsCapacity * 0.3)}) permitiria comprar à vista em cerca de ${months} meses.`);
  }
  if (isInstallment && severity >= 2) alternatives.push("Reduzir o número de parcelas ou dar uma entrada diminui o comprometimento futuro.");

  const verdict = (["confortavel", "planejamento", "compromete_metas", "nao_recomendada"] as const)[severity];
  return { verdict, label: VERDICT_LABELS[verdict], reasons, alternatives, metrics };
}

const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
const pctTxt = (v: number) => `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
