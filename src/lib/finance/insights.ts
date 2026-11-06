// Alertas e oportunidades determinísticos, priorizados e limitados para evitar excesso.

import { BudgetLine, CategoryLimitStatus } from "./budget";
import { daysBetween } from "./dates";
import { GoalAnalysis } from "./goals";
import { ReserveAnalysis } from "./reserve";
import { Snapshot } from "./snapshot";
import { Transaction, num } from "./types";

export type Severity = "critico" | "alto" | "medio" | "info";
export type InsightKind = "risco" | "alerta" | "oportunidade" | "positivo";

export interface Insight {
  id: string;
  kind: InsightKind;
  severity: Severity;
  title: string;
  detail: string;
  href?: string;
}

const SEV_ORDER: Record<Severity, number> = { critico: 0, alto: 1, medio: 2, info: 3 };

interface Ctx {
  s: Snapshot;
  reserve: ReserveAnalysis;
  goals: GoalAnalysis[];
  budget: BudgetLine[] | null;
  limits: CategoryLimitStatus[];
  transactions: Transaction[];
}

export function generateInsights(ctx: Ctx, max = 8): Insight[] {
  const { s, reserve, goals, budget, limits } = ctx;
  const out: Insight[] = [];
  const income = s.income.monthlyNet;
  const add = (i: Insight) => out.push(i);

  if (!s.dataQuality.hasIncome) {
    add({ id: "sem_renda", kind: "alerta", severity: "alto", title: "Renda não cadastrada", detail: "Sem a renda líquida não é possível avaliar orçamento, metas e riscos.", href: "/perfil" });
  }

  // Atrasos
  for (const c of s.cards) {
    if (c.overdueAmount > 0) add({ id: `atraso_${c.card.id}`, kind: "risco", severity: "critico", title: `Fatura em atraso: ${c.card.name}`, detail: `${fmt(c.overdueAmount)} vencidos. Juros do rotativo estão entre os mais altos do mercado — priorize a quitação.`, href: "/cartoes" });
  }
  if (s.debts.lateCount > s.cards.filter((c) => c.overdueAmount > 0).length) {
    add({ id: "divida_atraso", kind: "risco", severity: "critico", title: "Dívidas em atraso", detail: "Há obrigações marcadas como em atraso. Negocie antes que multas e juros se acumulem.", href: "/perfil#obrigacoes" });
  }

  // Fluxo negativo
  if (income > 0 && s.savingsCapacity < 0) {
    add({ id: "deficit", kind: "risco", severity: "critico", title: "Gastos acima da renda", detail: `Gastos de referência e parcelas superam a renda em ${fmt(-s.savingsCapacity)}/mês. Isso consome patrimônio ou gera dívidas.`, href: "/orcamento" });
  }

  // Comprometimento
  if (income > 0 && s.debtRatio > 0.3) {
    add({ id: "endividamento", kind: "risco", severity: s.debtRatio > 0.45 ? "critico" : "alto", title: "Parcelas comprometem muito a renda", detail: `${pctTxt(s.debtRatio)} da renda vai para empréstimos e financiamentos (prudente: até 30%). Evite novas dívidas.`, href: "/perfil#obrigacoes" });
  }
  const peak = s.futureCommitments.slice(1, 6).reduce((m, f) => (f.shareOfIncome > m.shareOfIncome ? f : m), s.futureCommitments[1] ?? s.futureCommitments[0]);
  if (income > 0 && peak && peak.shareOfIncome > 0.4) {
    add({ id: "compromisso_futuro", kind: "alerta", severity: "alto", title: `Compromissos elevados em ${peak.label}`, detail: `Faturas e parcelas somam ${fmt(peak.total)} (${pctTxt(peak.shareOfIncome)} da renda).`, href: "/cartoes" });
  }

  // Cartões
  for (const c of s.cards) {
    if (c.utilization >= 0.7) add({ id: `limite_${c.card.id}`, kind: "alerta", severity: c.utilization >= 0.9 ? "alto" : "medio", title: `Limite do ${c.card.name} muito utilizado`, detail: `${pctTxt(c.utilization)} do limite em uso (${fmt(c.used)} de ${fmt(c.limit)}), incluindo parcelas futuras.`, href: "/cartoes" });
    if (c.nextBill && c.nextBill.state === "fechada") {
      const days = daysBetween(s.today, c.nextBill.dueDate);
      if (days >= 0 && days <= 5) add({ id: `vence_${c.card.id}`, kind: "alerta", severity: "medio", title: `Fatura do ${c.card.name} vence em ${days === 0 ? "hoje" : `${days} dia(s)`}`, detail: `Valor a pagar: ${fmt(c.nextBill.remaining)}.`, href: "/cartoes" });
    }
    if (income > 0 && c.nextBill && c.nextBill.remaining > income * 0.35) {
      add({ id: `fatura_alta_${c.card.id}`, kind: "alerta", severity: "alto", title: `Fatura elevada no ${c.card.name}`, detail: `${fmt(c.nextBill.remaining)} — ${pctTxt(c.nextBill.remaining / income)} da renda mensal.`, href: "/cartoes" });
    }
  }
  if (s.freeToSpend.cashFree < 0 && (s.futureCommitments[0]?.total ?? 0) > 0) {
    add({ id: "caixa", kind: "alerta", severity: "alto", title: "Saldo disponível não cobre os compromissos do mês", detail: `Faltam ${fmt(-s.freeToSpend.cashFree)} para faturas e parcelas que vencem neste mês.`, href: "/" });
  }

  // Reserva
  if (income > 0 && s.essentialMonthlyCost > 0) {
    if (reserve.coverageMonths < 1) add({ id: "reserva_baixa", kind: "risco", severity: "alto", title: "Reserva de emergência insuficiente", detail: `Cobre ${reserve.coverageMonths.toFixed(1)} mês das despesas essenciais. Meta recomendada: ${fmt(reserve.recommended)}.`, href: "/reserva" });
    else if (reserve.coverageMonths < 3) add({ id: "reserva_media", kind: "alerta", severity: "medio", title: "Reserva abaixo de 3 meses", detail: `Cobertura atual: ${reserve.coverageMonths.toFixed(1)} meses. Faltam ${fmt(reserve.gap)} para a meta recomendada.`, href: "/reserva" });
    else if (reserve.coverageMonths >= reserve.recommendedMonths) add({ id: "reserva_ok", kind: "positivo", severity: "info", title: "Reserva de emergência completa", detail: `Cobre ${reserve.coverageMonths.toFixed(1)} meses de despesas essenciais.` });
  }

  // Orçamento
  if (budget) {
    for (const b of budget) {
      if (b.planned > 0 && b.progress > 1 && (b.key === "pessoais" || b.key === "lazer" || b.key === "essenciais")) {
        add({ id: `orc_${b.key}`, kind: "alerta", severity: b.progress > 1.2 ? "alto" : "medio", title: `${b.label} acima do orçamento`, detail: `${fmt(b.spent)} gastos de ${fmt(b.planned)} planejados (+${fmt(-b.remaining)}).`, href: "/orcamento" });
      }
    }
  }
  for (const l of limits) {
    if (l.progress > 1) add({ id: `lim_${l.categoryId}`, kind: "alerta", severity: "medio", title: `Limite de ${l.name} ultrapassado`, detail: `${fmt(l.spent)} de ${fmt(l.limit)} no mês.`, href: "/orcamento" });
    else if (l.progress >= 0.85) add({ id: `lim_${l.categoryId}`, kind: "alerta", severity: "info", title: `${l.name} perto do limite`, detail: `${pctTxt(l.progress)} do limite mensal usado.`, href: "/orcamento" });
  }

  // Categorias: crescimento e peso excessivo
  for (const c of s.categories) {
    if (c.average >= 100 && c.growth !== null && c.growth > 0.35 && c.thisMonth - c.average * 0.5 > 80) {
      add({ id: `cresc_${c.id}`, kind: "alerta", severity: "medio", title: `${c.name} cresceu acima do normal`, detail: `${fmt(c.thisMonth)} até agora no mês, contra média de ${fmt(c.average)} por mês completo.`, href: "/despesas" });
    }
    const limitShare = c.bucket === "lazer" ? 0.12 : c.bucket === "pessoais" ? 0.15 : 1;
    if (income > 0 && c.shareOfIncome > limitShare) {
      add({ id: `peso_${c.id}`, kind: "oportunidade", severity: "medio", title: `${c.name} consome ${pctTxt(c.shareOfIncome)} da renda`, detail: `Avalie se esse gasto entrega valor proporcional. Uma redução de 20% liberaria ${fmt((c.average || c.thisMonth) * 0.2)}/mês.`, href: "/despesas" });
    }
  }

  // Assinaturas
  const subs = s.recurring.filter((r) => r.recurrence === "mensal" && !r.essential && r.amount <= 150);
  if (subs.length >= 4) {
    const total = subs.reduce((a, r) => a + r.monthly, 0);
    add({ id: "assinaturas", kind: "oportunidade", severity: "info", title: `${subs.length} assinaturas recorrentes`, detail: `Somam ${fmt(total)}/mês (${fmt(total * 12)}/ano). Revise as que você usa pouco: ${subs.slice(0, 4).map((x) => x.description).join(", ")}.`, href: "/despesas" });
  }

  // Compras por impulso: não essenciais grandes ou muitas pequenas no mês
  const monthTx = ctx.transactions.filter((t) => t.kind === "expense" && t.occurred_on.slice(0, 7) === s.monthKey && !t.is_essential && t.recurrence === "nenhuma");
  const big = monthTx.filter((t) => income > 0 && num(t.amount) > income * 0.1);
  if (big.length) add({ id: "impulso_grande", kind: "alerta", severity: "medio", title: "Compras não essenciais de alto valor", detail: `${big.length} compra(s) acima de 10% da renda neste mês: ${big.slice(0, 3).map((t) => `${t.description} (${fmt(num(t.amount))})`).join(", ")}.`, href: "/despesas" });
  const small = monthTx.filter((t) => num(t.amount) < 60);
  const smallTotal = small.reduce((a, t) => a + num(t.amount), 0);
  if (small.length >= 12 && income > 0 && smallTotal > income * 0.05) add({ id: "impulso_pequeno", kind: "oportunidade", severity: "info", title: "Muitos gastos pequenos não essenciais", detail: `${small.length} compras abaixo de R$ 60 somam ${fmt(smallTotal)} neste mês — pequenos gastos frequentes costumam passar despercebidos.`, href: "/despesas" });

  // Metas
  const late = goals.filter((g) => g.goal.status === "ativa" && g.status === "atrasada");
  if (late.length) add({ id: "metas_atrasadas", kind: "alerta", severity: "medio", title: `${late.length} meta(s) fora do ritmo`, detail: late.slice(0, 3).map((g) => `${g.goal.name}: precisa de ${fmt(g.requiredMonthly ?? 0)}/mês`).join(" · "), href: "/metas" });

  // Positivo
  if (income > 0 && s.savingsRate >= 0.2) add({ id: "poupanca_boa", kind: "positivo", severity: "info", title: "Ótima capacidade de economia", detail: `Você consegue poupar cerca de ${pctTxt(s.savingsRate)} da renda.` });

  // Prioriza e remove duplicatas
  const seen = new Set<string>();
  return out
    .filter((i) => (seen.has(i.id) ? false : (seen.add(i.id), true)))
    .sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity])
    .slice(0, max);
}

const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
const pctTxt = (v: number) => `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
