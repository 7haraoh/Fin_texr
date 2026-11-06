// Orçamento personalizado: parte da realidade do usuário (gastos essenciais
// observados, dívidas, reserva, metas e estilo de vida), não de regras fixas.

import { GoalAnalysis } from "./goals";
import { ReserveAnalysis } from "./reserve";
import { Snapshot } from "./snapshot";
import { AllocationKey, Allocations, Category, CategoryLimit, Lifestyle, Transaction, num, round2 } from "./types";
import { monthKey } from "./dates";

export const ALLOCATION_LABELS: Record<AllocationKey, string> = {
  essenciais: "Despesas essenciais",
  pessoais: "Despesas pessoais",
  lazer: "Lazer e qualidade de vida",
  reserva: "Reserva de emergência",
  investimentos: "Investimentos",
  metas_curto: "Metas de curto prazo",
  metas_longo: "Metas de longo prazo",
};

export const ALLOCATION_ORDER: AllocationKey[] = [
  "essenciais", "pessoais", "lazer", "reserva", "investimentos", "metas_curto", "metas_longo",
];

export interface BudgetSuggestion {
  allocations: Record<AllocationKey, number>;
  notes: string[];
  deficit: number; // > 0 quando essenciais superam a renda
}

export function suggestBudget(
  s: Snapshot, goals: GoalAnalysis[], reserve: ReserveAnalysis, lifestyle: Lifestyle = {},
): BudgetSuggestion {
  const income = s.income.monthlyNet;
  const notes: string[] = [];
  const recurringEssential = s.recurring.filter((r) => r.essential).reduce((a, r) => a + r.monthly, 0);
  const essenciais = round2(Math.max(s.baseline.essential, recurringEssential) + s.debts.monthlyPayments);
  const alloc: Record<AllocationKey, number> = {
    essenciais, pessoais: 0, lazer: 0, reserva: 0, investimentos: 0, metas_curto: 0, metas_longo: 0,
  };
  const free = income - essenciais;

  if (income <= 0) {
    notes.push("Cadastre sua renda líquida para gerar uma sugestão de orçamento.");
    return { allocations: alloc, notes, deficit: 0 };
  }
  notes.push(`Essenciais baseados nos seus gastos reais (${basisText(s)}) e em ${fmt(s.debts.monthlyPayments)} de parcelas de dívidas.`);
  if (free <= 0) {
    notes.push(`Suas despesas essenciais superam a renda em ${fmt(-free)}. Prioridade: renegociar dívidas e reduzir custos fixos antes de qualquer outro objetivo.`);
    return { allocations: alloc, notes, deficit: round2(-free) };
  }

  // Reserva e investimentos conforme a cobertura atual
  const cov = reserve.coverageMonths;
  let reserveShare: number, investShare: number;
  if (cov < 3) { reserveShare = 0.3; investShare = 0; notes.push(`Reserva cobre ${cov.toFixed(1)} meses: ela é a prioridade de poupança agora.`); }
  else if (cov < reserve.recommendedMonths) { reserveShare = 0.18; investShare = 0.07; notes.push(`Reserva em construção (${cov.toFixed(1)} de ${reserve.recommendedMonths} meses): divisão entre reserva e investimentos.`); }
  else { reserveShare = 0; investShare = 0.2; notes.push("Reserva completa: a poupança passa a ir para investimentos e metas."); }

  // Lazer conforme preferência economizar × aproveitar
  const pref = Math.min(5, Math.max(1, lifestyle.save_vs_enjoy ?? 3));
  let lazerShare = 0.12 + (pref - 1) * 0.045; // 12% … 30% do valor livre
  if (lifestyle.travel_frequency === "frequente" || lifestyle.travel_frequency === "semestral") {
    notes.push("Como viagens são importantes para você, parte do lazer pode alimentar uma meta de viagem — sem cortá-las.");
  }

  // Metas (excluindo a meta de reserva, coberta acima)
  const active = goals.filter((g) => g.goal.status === "ativa" && g.status !== "concluida" && g.goal.type !== "reserva");
  const need = (h: "curto" | "longo") =>
    active.filter((g) => g.goal.horizon === h).reduce((a, g) => a + Math.max(g.planned, g.requiredMonthly ?? 0), 0);
  let goalsCurto = need("curto"), goalsLongo = need("longo");
  const goalsCap = free * 0.3;
  if (goalsCurto + goalsLongo > goalsCap) {
    const k = goalsCap / (goalsCurto + goalsLongo);
    notes.push(`As metas pedem ${fmt(goalsCurto + goalsLongo)}/mês; limitamos a ${fmt(goalsCap)} para manter o orçamento equilibrado — reveja prazos.`);
    goalsCurto *= k; goalsLongo *= k;
  }

  // Pessoais: o necessário observado, com piso de 10% do valor livre
  const observedPessoais = s.history.slice(0, -1).filter((f) => f.hasData).slice(-3);
  const avgPessoais = observedPessoais.length
    ? observedPessoais.reduce((a, f) => a + f.byBucket.pessoais, 0) / observedPessoais.length : free * 0.15;

  let reserva = free * reserveShare, invest = free * investShare, lazer = free * lazerShare;
  let pessoais = free - reserva - invest - lazer - goalsCurto - goalsLongo;
  const minPessoais = Math.max(free * 0.1, Math.min(avgPessoais, free * 0.3));
  if (pessoais < minPessoais) {
    // Ajusta proporcionalmente lazer, investimentos e metas (preserva a reserva se < 3 meses)
    const shortfall = minPessoais - pessoais;
    const flex = lazer * 0.5 + invest + goalsCurto + goalsLongo + (cov >= 3 ? reserva * 0.5 : 0);
    const k = flex > 0 ? Math.min(1, shortfall / flex) : 0;
    lazer -= lazer * 0.5 * k; invest -= invest * k; goalsCurto -= goalsCurto * k; goalsLongo -= goalsLongo * k;
    if (cov >= 3) reserva -= reserva * 0.5 * k;
    pessoais = free - reserva - invest - lazer - goalsCurto - goalsLongo;
  } else if (pessoais > avgPessoais * 1.3 && observedPessoais.length) {
    // Sobra: vai para poupança (reserva se incompleta, senão investimentos)
    const extra = pessoais - avgPessoais * 1.2;
    pessoais -= extra;
    if (cov < reserve.recommendedMonths) reserva += extra; else invest += extra;
  }

  alloc.pessoais = round2(pessoais);
  alloc.lazer = round2(lazer);
  alloc.reserva = round2(reserva);
  alloc.investimentos = round2(invest);
  alloc.metas_curto = round2(goalsCurto);
  alloc.metas_longo = round2(goalsLongo);
  // Ajuste de centavos para fechar exatamente na renda
  const sum = ALLOCATION_ORDER.reduce((a, k) => a + alloc[k], 0);
  alloc.pessoais = round2(alloc.pessoais + (income - sum));
  return { allocations: alloc, notes, deficit: 0 };
}

export interface BudgetLine {
  key: AllocationKey;
  label: string;
  planned: number;
  spent: number;
  remaining: number;
  progress: number;
}

/** Consumo do mês por finalidade. */
export function budgetStatus(s: Snapshot, allocations: Allocations): BudgetLine[] {
  const m = s.month;
  const spent: Record<AllocationKey, number> = {
    essenciais: m.byBucket.essenciais + m.byBucket.financeiro + m.debtPayments,
    pessoais: m.byBucket.pessoais,
    lazer: m.byBucket.lazer,
    reserva: 0,
    investimentos: m.invested,
    metas_curto: 0,
    metas_longo: 0,
  };
  return ALLOCATION_ORDER.map((key) => {
    const planned = num(allocations[key]);
    const sp = round2(spent[key]);
    return { key, label: ALLOCATION_LABELS[key], planned, spent: sp, remaining: round2(planned - sp), progress: planned > 0 ? sp / planned : sp > 0 ? 1 : 0 };
  });
}

export interface CategoryLimitStatus {
  categoryId: string;
  name: string;
  group: string;
  limit: number;
  spent: number;
  remaining: number;
  progress: number;
}

export function categoryLimitStatus(
  limits: CategoryLimit[], categories: Category[], transactions: Transaction[], key: string,
): CategoryLimitStatus[] {
  const byId = new Map(categories.map((c) => [c.id, c]));
  return limits.map((l) => {
    const c = byId.get(l.category_id);
    const spent = round2(transactions
      .filter((t) => t.kind === "expense" && t.category_id === l.category_id && monthKey(t.occurred_on) === key)
      .reduce((a, t) => a + num(t.amount), 0));
    const limit = num(l.monthly_limit);
    return {
      categoryId: l.category_id, name: c?.name ?? "—", group: c?.group_name ?? "", limit, spent,
      remaining: round2(limit - spent), progress: limit > 0 ? spent / limit : 0,
    };
  }).sort((a, b) => b.progress - a.progress);
}

function basisText(s: Snapshot): string {
  if (s.baseline.basis === "meses_completos") return `média de ${s.baseline.months} ${s.baseline.months === 1 ? "mês" : "meses"}`;
  if (s.baseline.basis === "mes_parcial") return "mês atual parcial";
  return "sem histórico ainda";
}

const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
