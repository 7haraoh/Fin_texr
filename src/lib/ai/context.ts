// Monta o contexto mínimo necessário para a IA: agregados calculados pelo motor
// determinístico. Não inclui e-mail, nomes de instituições, observações livres
// nem a lista completa de lançamentos.

import type { Analysis } from "@/lib/finance/analyze";
import type { FinancialData } from "@/lib/finance/types";
import { ALLOCATION_LABELS, ALLOCATION_ORDER } from "@/lib/finance/budget";
import { dateBR } from "@/lib/finance/format";

const r = (v: number) => Math.round(v * 100) / 100;
const p = (v: number) => `${(v * 100).toFixed(1)}%`;

export function buildAdvisorContext(data: FinancialData, a: Analysis, today: string): string {
  const s = a.snapshot;
  const lifestyle = data.profile?.lifestyle ?? {};
  const ctx = {
    data_de_hoje: dateBR(today),
    qualidade_dos_dados: {
      dados_faltantes: s.dataQuality.missing,
      meses_completos_de_historico: s.dataQuality.completeMonths,
      base_dos_gastos_de_referencia: s.baseline.basis,
    },
    saude_financeira: a.health.score === null
      ? { classificacao: "dados insuficientes", pendencias: a.health.insufficient }
      : {
          pontuacao_0_100: a.health.score,
          classificacao: a.health.label,
          componentes: a.health.components.map((c) => ({ fator: c.label, nota_0_1: r(c.score), detalhe: c.detail })),
        },
    renda: {
      liquida_mensal_recorrente: s.income.monthlyNet,
      bruta_mensal: s.income.monthlyGross,
      parcela_estavel: p(s.income.stableShare),
      fontes: s.income.sources.map((x) => ({ tipo: x.type, mensal: x.monthly, estabilidade: x.stability })),
      mudancas_previstas: s.income.expectedChanges.map((c) => ({ percentual: c.pct, data: dateBR(c.date) })),
      rendas_extras_no_mes: s.month.extraIncome,
    },
    patrimonio: {
      patrimonio_liquido: s.netWorth,
      ativos_total: s.assets.total,
      saldo_disponivel_contas_e_especie: s.assets.available,
      liquidez_total_inclui_poupanca_e_reserva: s.assets.liquid,
      reserva_de_emergencia: s.assets.reserve,
      investimentos: s.assets.investments,
      bens_iliquidos: s.assets.illiquid,
    },
    obrigacoes: {
      saldo_devedor_emprestimos_financiamentos: s.debts.loansOutstanding,
      parcelas_mensais_de_dividas: s.debts.monthlyPayments,
      cartoes_saldo_devedor_inclui_parcelas_futuras: s.debts.cardUsed,
      proximas_faturas: s.debts.cardNextBills,
      faturas_em_atraso: s.debts.cardOverdue,
      itens_em_atraso: s.debts.lateCount,
      maior_juros_mensal_pct: s.debts.highestMonthlyRate,
      dividas: data.debts.map((d) => ({
        tipo: d.type, saldo: Number(d.outstanding_balance), parcela: Number(d.monthly_payment),
        juros_mensal_pct: d.interest_rate_monthly === null ? null : Number(d.interest_rate_monthly),
        parcelas_restantes: d.remaining_installments, em_atraso: d.is_late,
      })),
      cartoes: s.cards.map((c) => ({
        nome: c.card.name, limite: c.limit, usado: c.used, uso_do_limite: p(c.utilization),
        proxima_fatura: c.nextBill ? { valor: c.nextBill.remaining, vencimento: dateBR(c.nextBill.dueDate) } : null,
        parcelas_futuras: c.futureInstallments, em_atraso: c.overdueAmount,
      })),
      compromissos_proximos_meses: s.futureCommitments.slice(0, 6).map((f) => ({ mes: f.label, total: f.total, pct_renda: p(f.shareOfIncome) })),
    },
    mes_atual: {
      despesas_ate_hoje: s.month.expenses,
      essenciais: s.month.essential,
      nao_essenciais: s.month.nonEssential,
      fixas: s.month.fixed,
      variaveis: s.month.variable,
      aportes_investimentos: s.month.invested,
      recorrentes_ainda_nao_lancadas: s.pendingRecurringThisMonth,
      economia_estimada_do_mes: s.month.savings,
    },
    referencia_mensal: {
      gastos_medios: s.baseline.expenses,
      essenciais_medios: s.baseline.essential,
      custo_essencial_mensal_com_dividas: s.essentialMonthlyCost,
      gastos_fixos_recorrentes: s.fixedMonthly,
      comprometimento_renda_fixos_e_dividas: p(s.commitmentRatio),
      capacidade_de_economia_mensal: s.savingsCapacity,
      taxa_de_economia: p(s.savingsRate),
      poupanca_planejada_no_mes: s.plannedSavings,
    },
    livre_para_gastar: {
      restante_no_mes_apos_compromissos_e_poupanca_planejada: s.freeToSpend.monthRemaining,
      por_dia_ate_o_fim_do_mes: s.freeToSpend.perDay,
      dias_restantes: s.freeToSpend.remainingDays,
      caixa_livre_apos_vencimentos_do_mes: s.freeToSpend.cashFree,
      sugestao_para_hoje: s.freeToSpend.today,
    },
    historico_6_meses: s.history.map((h) => ({ mes: h.label, renda: h.income, despesas: h.expenses, economia: h.savings, tem_lancamentos: h.hasData })),
    categorias_principais: s.categories.slice(0, 12).map((c) => ({
      categoria: `${c.group} › ${c.name}`, mes_atual: c.thisMonth, media_mensal: c.average, pct_renda: p(c.shareOfIncome),
    })),
    recorrencias: s.recurring.slice(0, 25).map((x) => ({ descricao: x.description.slice(0, 60), valor_mensal: x.monthly, essencial: x.essential })),
    reserva: {
      cobertura_meses: a.reserve.coverageMonths,
      recomendada_meses: a.reserve.recommendedMonths,
      valor_recomendado: a.reserve.recommended,
      falta: a.reserve.gap,
      aporte_mensal_considerado: a.reserve.monthlyContribution,
      meses_para_atingir: a.reserve.monthsToRecommended,
    },
    orcamento: {
      plano_do_mes: a.budget
        ? a.budget.map((b) => ({ finalidade: b.label, planejado: b.planned, consumido: b.spent, restante: b.remaining }))
        : "sem orçamento salvo para este mês",
      sugestao_do_sistema: ALLOCATION_ORDER.map((k) => ({ finalidade: ALLOCATION_LABELS[k], valor: a.suggestion.allocations[k] })),
      limites_por_categoria: a.limits.map((l) => ({ categoria: l.name, limite: l.limit, gasto: l.spent })),
    },
    metas: a.goals.map((g) => ({
      nome: g.goal.name.slice(0, 60), tipo: g.goal.type, prioridade: g.goal.priority, situacao: g.goal.status,
      alvo: g.target, acumulado: g.current, progresso: p(g.progress), prazo: dateBR(g.goal.deadline),
      aporte_planejado: g.planned, aporte_necessario: g.requiredMonthly, status: g.status,
    })),
    viabilidade_das_metas: a.feasibility.message,
    alertas_do_sistema: a.insights.map((i) => `[${i.severity}] ${i.title}: ${i.detail}`),
    perfil: {
      perfil_de_risco: data.profile?.risk_profile ?? "não informado",
      dependentes: lifestyle.dependents ?? "não informado",
      plano_de_saude: lifestyle.health_plan === undefined ? "não informado" : lifestyle.health_plan ? `sim${lifestyle.health_plan_name ? ` (${lifestyle.health_plan_name})` : ""}` : "não",
      preferencia_economizar_1_a_aproveitar_5: lifestyle.save_vs_enjoy ?? "não informado",
      frequencia_de_viagens: lifestyle.travel_frequency ?? "não informado",
      habitos: lifestyle.habits, hobbies: lifestyle.hobbies, alimentacao: lifestyle.food_habits,
      lazer: lifestyle.leisure, objetivos_pessoais: lifestyle.personal_goals,
      padrao_de_vida_desejado: lifestyle.desired_lifestyle, planos_familiares: lifestyle.family_plans,
      projetos_futuros: lifestyle.future_projects,
    },
  };
  return `<fotografia_financeira>\n${JSON.stringify(ctx)}\n</fotografia_financeira>`;
}
