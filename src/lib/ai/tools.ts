// Ferramentas determinísticas expostas ao consultor. A IA decide QUANDO calcular;
// o backend calcula. Toda entrada é validada com zod antes da execução.

import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { Analysis } from "@/lib/finance/analyze";
import type { FinancialData } from "@/lib/finance/types";
import { compareCashVsInstallments, evaluatePurchase, priceInstallment } from "@/lib/finance/purchase";
import { stressTest } from "@/lib/finance/reserve";
import { DEFAULT_SCENARIOS, SCENARIO_LABELS, project, type ScenarioKey } from "@/lib/finance/projection";

/** Rendimento mensal de referência para custo de oportunidade (aprox. renda fixa pós-fixada). */
export const REFERENCE_YIELD_MONTHLY_PCT = 0.85;

const purchaseInput = z.object({
  item: z.string().max(120),
  valor: z.number().positive().max(1e9),
  forma_pagamento: z.enum(["avista", "credito_parcelado", "financiado"]),
  parcelas: z.number().int().min(1).max(420).default(1),
  juros_mensal_pct: z.number().min(0).max(30).default(0),
  desconto_avista_pct: z.number().min(0).max(90).default(0),
  necessidade: z.enum(["necessidade", "melhoria", "desejo"]),
});

const goalInput = z.object({
  valor_alvo: z.number().positive().max(1e10),
  valor_atual: z.number().min(0).max(1e10).default(0),
  prazo_meses: z.number().int().min(1).max(600).optional(),
  aporte_mensal: z.number().min(0).max(1e9).optional(),
  rendimento_mensal_pct: z.number().min(0).max(5).default(0),
});

const financingInput = z.object({
  valor_bem: z.number().positive().max(1e10),
  entrada: z.number().min(0).max(1e10).default(0),
  parcelas: z.number().int().min(1).max(420),
  juros_mensal_pct: z.number().min(0).max(30),
});

const projectionInput = z.object({ meses: z.number().int().min(1).max(120) });
const stressInput = z.object({
  reducao_renda_pct: z.number().min(0).max(100).default(30),
  custo_medico: z.number().min(0).max(1e9).default(5000),
  custo_veiculo: z.number().min(0).max(1e9).default(3000),
  custo_extraordinario: z.number().min(0).max(1e9).default(5000),
});

export const ADVISOR_TOOLS: Anthropic.Tool[] = [
  {
    name: "simular_compra",
    description: "Avalia se uma compra cabe no orçamento do usuário considerando saldo disponível, compromissos futuros, reserva, metas e capacidade de economia. Retorna veredito (confortável / exige planejamento / compromete metas / não recomendada), motivos, alternativas e, se parcelado, a comparação com pagamento à vista. Use sempre que o usuário perguntar se pode comprar algo.",
    input_schema: {
      type: "object",
      properties: {
        item: { type: "string", description: "Produto ou serviço" },
        valor: { type: "number", description: "Preço cheio em reais" },
        forma_pagamento: { type: "string", enum: ["avista", "credito_parcelado", "financiado"] },
        parcelas: { type: "integer", description: "Quantidade de parcelas (1 se à vista)" },
        juros_mensal_pct: { type: "number", description: "Juros do parcelamento em % ao mês (0 se sem juros ou desconhecido)" },
        desconto_avista_pct: { type: "number", description: "Desconto para pagamento à vista, em %" },
        necessidade: { type: "string", enum: ["necessidade", "melhoria", "desejo"], description: "Finalidade da compra" },
      },
      required: ["item", "valor", "forma_pagamento", "necessidade"],
    },
  },
  {
    name: "planejar_objetivo",
    description: "Calcula quanto tempo leva para juntar um valor com um aporte mensal, ou qual aporte mensal é necessário para atingir o valor num prazo, e compara com a capacidade de economia do usuário.",
    input_schema: {
      type: "object",
      properties: {
        valor_alvo: { type: "number" },
        valor_atual: { type: "number", description: "Quanto já está guardado para isso" },
        prazo_meses: { type: "integer", description: "Prazo desejado em meses (opcional)" },
        aporte_mensal: { type: "number", description: "Aporte mensal pretendido (opcional)" },
        rendimento_mensal_pct: { type: "number", description: "Rendimento mensal estimado em %, 0 para ignorar" },
      },
      required: ["valor_alvo"],
    },
  },
  {
    name: "simular_financiamento",
    description: "Simula um financiamento ou empréstimo pela tabela Price e mostra parcela, custo total, juros pagos e como o comprometimento da renda ficaria.",
    input_schema: {
      type: "object",
      properties: {
        valor_bem: { type: "number" },
        entrada: { type: "number" },
        parcelas: { type: "integer" },
        juros_mensal_pct: { type: "number", description: "Taxa de juros em % ao mês" },
      },
      required: ["valor_bem", "parcelas", "juros_mensal_pct"],
    },
  },
  {
    name: "projetar_patrimonio",
    description: "Projeta renda, gastos, economia e patrimônio líquido em cenários conservador, realista e otimista para N meses. Resultados são estimativas com premissas explícitas.",
    input_schema: {
      type: "object",
      properties: { meses: { type: "integer", description: "Horizonte em meses (ex.: 6, 12, 36, 60)" } },
      required: ["meses"],
    },
  },
  {
    name: "testar_cenarios_adversos",
    description: "Mostra por quantos meses o usuário mantém o padrão essencial de vida em perda de emprego, redução de renda, despesa médica, manutenção de veículo e despesa extraordinária.",
    input_schema: {
      type: "object",
      properties: {
        reducao_renda_pct: { type: "number" },
        custo_medico: { type: "number" },
        custo_veiculo: { type: "number" },
        custo_extraordinario: { type: "number" },
      },
    },
  },
];

export const TOOL_LABELS: Record<string, string> = {
  simular_compra: "Simulando a compra",
  planejar_objetivo: "Calculando o plano",
  simular_financiamento: "Simulando o financiamento",
  projetar_patrimonio: "Projetando cenários",
  testar_cenarios_adversos: "Testando cenários adversos",
};

export function runAdvisorTool(name: string, rawInput: unknown, data: FinancialData, a: Analysis): string {
  const s = a.snapshot;
  switch (name) {
    case "simular_compra": {
      const i = purchaseInput.parse(rawInput);
      const ev = evaluatePurchase(s, a.reserve, {
        item: i.item, price: i.valor, method: i.forma_pagamento, installments: i.parcelas,
        monthlyInterestPct: i.juros_mensal_pct, cashDiscountPct: i.desconto_avista_pct, need: i.necessidade,
      });
      const comparison = i.parcelas > 1 || i.desconto_avista_pct > 0
        ? compareCashVsInstallments(i.valor, i.desconto_avista_pct, Math.max(2, i.parcelas), i.juros_mensal_pct, REFERENCE_YIELD_MONTHLY_PCT)
        : null;
      return JSON.stringify({
        veredito: ev.label, motivos: ev.reasons, alternativas: ev.alternatives,
        metricas: {
          pagamento_imediato: ev.metrics.upfront, parcela: ev.metrics.installment, custo_total: ev.metrics.totalCost,
          parcela_pct_renda: pctNum(ev.metrics.shareOfIncome), comprometimento_apos: pctNum(ev.metrics.newCommitmentRatio),
          economia_mensal_apos: ev.metrics.savingsAfter, caixa_apos_compra_e_vencimentos: ev.metrics.cashAfter,
          meses_de_economia_equivalentes: ev.metrics.monthsOfSavings,
        },
        avista_vs_parcelado: comparison && {
          ...comparison,
          premissa: `custo de oportunidade com rendimento de ${REFERENCE_YIELD_MONTHLY_PCT}% a.m. (estimativa)`,
        },
      });
    }
    case "planejar_objetivo": {
      const i = goalInput.parse(rawInput);
      const remaining = Math.max(0, i.valor_alvo - i.valor_atual);
      const rate = i.rendimento_mensal_pct / 100;
      let months: number | null = null;
      let required: number | null = null;
      if (i.aporte_mensal && i.aporte_mensal > 0) {
        let acc = i.valor_atual; months = 0;
        while (acc < i.valor_alvo && months < 1200) { acc = acc * (1 + rate) + i.aporte_mensal; months++; }
        if (months >= 1200) months = null;
      }
      if (i.prazo_meses) {
        const n = i.prazo_meses;
        const fvCurrent = i.valor_atual * Math.pow(1 + rate, n);
        const factor = rate > 0 ? (Math.pow(1 + rate, n) - 1) / rate : n;
        required = Math.max(0, (i.valor_alvo - fvCurrent) / factor);
      }
      const capacity = s.savingsCapacity;
      const monthly = required ?? i.aporte_mensal ?? null;
      return JSON.stringify({
        falta_acumular: round(remaining), meses_necessarios_com_aporte: months, aporte_necessario_no_prazo: required === null ? null : round(required),
        capacidade_de_economia_mensal: capacity,
        pct_da_capacidade: monthly !== null && capacity > 0 ? pctNum(monthly / capacity) : null,
        cabe_no_orcamento: monthly !== null ? monthly <= Math.max(0, capacity) : null,
        observacao: capacity <= 0 ? "Capacidade de economia atual é zero ou negativa: é preciso ajustar gastos antes de assumir o objetivo." : undefined,
      });
    }
    case "simular_financiamento": {
      const i = financingInput.parse(rawInput);
      const principal = Math.max(0, i.valor_bem - i.entrada);
      const pmt = priceInstallment(principal, i.parcelas, i.juros_mensal_pct / 100);
      const total = pmt * i.parcelas;
      const income = s.income.monthlyNet;
      return JSON.stringify({
        valor_financiado: round(principal), parcela: round(pmt), total_pago_parcelas: round(total), juros_totais: round(total - principal),
        custo_efetivo_anual_aprox_pct: round((Math.pow(1 + i.juros_mensal_pct / 100, 12) - 1) * 100),
        parcela_pct_renda: income > 0 ? pctNum(pmt / income) : null,
        comprometimento_com_dividas_apos: income > 0 ? pctNum((s.debts.monthlyPayments + pmt) / income) : null,
        comprometimento_total_apos: income > 0 ? pctNum((s.fixedMonthly + s.debts.monthlyPayments + pmt) / income) : null,
        economia_mensal_apos: round(s.savingsCapacity - pmt),
        entrada_vs_saldo_disponivel: { entrada: i.entrada, disponivel: s.assets.available, reserva: s.assets.reserve },
        referencia: "Prudência: parcelas de dívidas somadas até ~30% da renda líquida.",
      });
    }
    case "projetar_patrimonio": {
      const { meses } = projectionInput.parse(rawInput);
      const result = (Object.keys(DEFAULT_SCENARIOS) as ScenarioKey[]).map((k) => {
        const series = project(s, data.debts, data.incomes, DEFAULT_SCENARIOS[k], meses);
        const last = series[series.length - 1];
        return {
          cenario: SCENARIO_LABELS[k],
          premissas: DEFAULT_SCENARIOS[k],
          patrimonio_liquido_final: last.netWorth, reserva_e_investimentos_final: last.liquidPool,
          dividas_final: last.debt, renda_mensal_final: last.income, economia_mensal_final: last.savings,
        };
      });
      return JSON.stringify({ aviso: "Estimativas — não são valores registrados nem garantia de resultado.", patrimonio_atual: s.netWorth, meses, cenarios: result });
    }
    case "testar_cenarios_adversos": {
      const i = stressInput.parse(rawInput ?? {});
      const out = stressTest(s, {
        incomeReductionPct: i.reducao_renda_pct / 100, medicalCost: i.custo_medico,
        carRepairCost: i.custo_veiculo, extraordinaryCost: i.custo_extraordinario,
      });
      return JSON.stringify({
        custo_essencial_mensal: s.essentialMonthlyCost,
        cenarios: out.map((c) => ({ cenario: c.label, renda_no_cenario: c.monthlyIncome, deficit_mensal: c.monthlyBurn, custo_imediato: c.upfrontCost, meses_de_sustentacao: c.survivalMonths ?? "indefinido (renda cobre o essencial)", avaliacao: c.verdict })),
      });
    }
    default:
      throw new Error(`Ferramenta desconhecida: ${name}`);
  }
}

const round = (v: number) => Math.round(v * 100) / 100;
const pctNum = (v: number) => (Number.isFinite(v) ? `${(v * 100).toFixed(1)}%` : null);
