import { describe, expect, it } from "vitest";
import { computeCardStatus, splitInstallments, statementDates, statementKeyForPurchase } from "./cards";
import { buildSnapshot } from "./snapshot";
import { analyze } from "./analyze";
import { compareCashVsInstallments, evaluatePurchase, priceInstallment } from "./purchase";
import { analyzeGoal } from "./goals";
import { levelFromScore } from "./health";
import { ALLOCATION_ORDER } from "./budget";
import { project, DEFAULT_SCENARIOS } from "./projection";
import { todayISO, addMonthsKey } from "./dates";
import { baseData, card, tx } from "./fixtures.test-helpers";

const TODAY = "2026-11-06";

describe("datas", () => {
  it("usa o fuso de Brasília", () => {
    // 02:00 UTC de 7/nov = 23:00 de 6/nov em Brasília
    expect(todayISO(new Date("2026-11-07T02:00:00Z"))).toBe("2026-11-06");
  });
  it("soma meses atravessando anos", () => {
    expect(addMonthsKey("2026-11", 3)).toBe("2027-02");
    expect(addMonthsKey("2026-01", -1)).toBe("2025-12");
  });
});

describe("cartões", () => {
  it("compra antes do fechamento entra na fatura do mês; no dia do fechamento, na seguinte", () => {
    expect(statementKeyForPurchase("2026-11-09", 10)).toBe("2026-11");
    expect(statementKeyForPurchase("2026-11-10", 10)).toBe("2026-12");
  });
  it("vencimento no mês seguinte quando o dia de vencimento é anterior ao fechamento", () => {
    expect(statementDates("2026-11", 25, 5)).toEqual({ closeDate: "2026-11-25", dueDate: "2026-12-05" });
    expect(statementDates("2026-11", 10, 20)).toEqual({ closeDate: "2026-11-10", dueDate: "2026-11-20" });
  });
  it("divide parcelas sem perder centavos", () => {
    const p = splitInstallments(100, 3);
    expect(p).toEqual([33.33, 33.33, 33.34]);
    expect(p.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 2);
  });
  it("aplica pagamentos às faturas mais antigas e calcula limite usado com parcelas futuras", () => {
    const txs = [
      tx({ amount: 1200, occurred_on: "2026-10-05", payment_method: "credito", card_id: card.id, installments: 3 }),
      tx({ amount: 400, kind: "card_payment", occurred_on: "2026-10-20", card_id: card.id }),
    ];
    const st = computeCardStatus(card, txs, TODAY);
    expect(st.statements.map((s) => [s.closeKey, s.remaining])).toEqual([
      ["2026-10", 0], ["2026-11", 400], ["2026-12", 400],
    ]);
    expect(st.used).toBe(800);
    expect(st.openStatement?.closeKey).toBe("2026-11");
    expect(st.futureInstallments).toBe(400);
    expect(st.overdueAmount).toBe(0);
  });
  it("marca fatura vencida não paga como atrasada", () => {
    const txs = [tx({ amount: 300, occurred_on: "2026-09-15", payment_method: "credito", card_id: card.id })];
    const st = computeCardStatus(card, txs, TODAY);
    expect(st.overdueAmount).toBe(300);
  });
});

describe("snapshot", () => {
  it("compra no cartão é consumo na data da compra e o pagamento da fatura não duplica a despesa", () => {
    const data = baseData({
      transactions: [
        tx({ amount: 900, occurred_on: "2026-11-02", payment_method: "credito", card_id: card.id, category_id: "c-roupas" }),
        tx({ amount: 900, kind: "card_payment", occurred_on: "2026-11-03", card_id: card.id }),
      ],
    });
    const s = buildSnapshot(data, TODAY);
    expect(s.month.expenses).toBe(900);
    expect(s.debts.cardUsed).toBe(0);
  });

  it("separa patrimônio, disponível e reserva sem dupla contagem", () => {
    const s = buildSnapshot(baseData(), TODAY);
    expect(s.assets.total).toBe(56000);
    expect(s.assets.available).toBe(4000);
    expect(s.assets.reserve).toBe(12000);
    expect(s.assets.liquid).toBe(16000);
    expect(s.netWorth).toBe(56000);
  });

  it("aportes em investimentos não contam como consumo", () => {
    const s = buildSnapshot(baseData({
      transactions: [tx({ amount: 1000, occurred_on: "2026-11-01", category_id: "c-invest" })],
    }), TODAY);
    expect(s.month.expenses).toBe(0);
    expect(s.month.invested).toBe(1000);
  });

  it("usa média de meses completos como referência e detecta recorrências pendentes", () => {
    const txs = [
      ...["2026-08", "2026-09", "2026-10"].flatMap((m) => [
        tx({ amount: 1500, occurred_on: `${m}-05`, category_id: "c-aluguel", is_essential: true, recurrence: "mensal", description: "Aluguel" }),
        tx({ amount: 900, occurred_on: `${m}-12`, category_id: "c-mercado", is_essential: true }),
        tx({ amount: 300, occurred_on: `${m}-15`, category_id: "c-delivery" }),
      ]),
      tx({ amount: 200, occurred_on: "2026-11-02", category_id: "c-mercado", is_essential: true }),
    ];
    const s = buildSnapshot(baseData({ transactions: txs }), TODAY);
    expect(s.baseline.basis).toBe("meses_completos");
    expect(s.baseline.expenses).toBe(2700);
    expect(s.baseline.essential).toBe(2400);
    expect(s.pendingRecurringThisMonth).toBe(1500);
    expect(s.savingsCapacity).toBe(3300);
    expect(s.essentialMonthlyCost).toBe(2400);
  });

  it("projeta compromissos futuros com dívidas e faturas", () => {
    const s = buildSnapshot(baseData({
      debts: [{ id: "d1", name: "Empréstimo", type: "emprestimo", outstanding_balance: 2000, monthly_payment: 500, interest_rate_monthly: 2, remaining_installments: 2, due_day: 10, is_late: false, notes: null }],
    }), TODAY);
    expect(s.futureCommitments.slice(0, 3).map((f) => f.debts)).toEqual([500, 500, 0]);
    expect(s.debtRatio).toBeCloseTo(500 / 6000);
  });
});

describe("saúde financeira", () => {
  it("classifica faixas", () => {
    expect(levelFromScore(85)).toBe("excelente");
    expect(levelFromScore(70)).toBe("saudavel");
    expect(levelFromScore(50)).toBe("atencao");
    expect(levelFromScore(30)).toBe("risco");
    expect(levelFromScore(10)).toBe("critico");
  });
  it("não classifica sem dados mínimos", () => {
    const a = analyze(baseData({ incomes: [] }), TODAY);
    expect(a.health.score).toBeNull();
    expect(a.health.insufficient.length).toBeGreaterThan(0);
  });
  it("limita a classificação quando os gastos superam a renda", () => {
    const a = analyze(baseData({
      transactions: [tx({ amount: 7000, occurred_on: "2026-10-10", is_essential: true, category_id: "c-aluguel" })],
    }), TODAY);
    expect(a.health.score!).toBeLessThan(45);
    expect(a.insights.some((i) => i.id === "deficit")).toBe(true);
  });
});

describe("orçamento", () => {
  it("distribui exatamente a renda líquida", () => {
    const txs = ["2026-09", "2026-10"].flatMap((m) => [
      tx({ amount: 2000, occurred_on: `${m}-05`, category_id: "c-aluguel", is_essential: true }),
      tx({ amount: 500, occurred_on: `${m}-08`, category_id: "c-roupas" }),
    ]);
    const a = analyze(baseData({ transactions: txs }), TODAY);
    const total = ALLOCATION_ORDER.reduce((s, k) => s + a.suggestion.allocations[k], 0);
    expect(total).toBeCloseTo(6000, 2);
    expect(a.suggestion.allocations.essenciais).toBe(2000);
    expect(Object.values(a.suggestion.allocations).every((v) => v >= 0)).toBe(true);
  });
});

describe("simulador de compras", () => {
  it("calcula prestação Price", () => {
    expect(priceInstallment(1000, 10, 0)).toBe(100);
    expect(priceInstallment(1000, 12, 0.02)).toBeCloseTo(94.56, 2);
  });
  it("não recomenda compra à vista que exige usar a reserva", () => {
    const a = analyze(baseData(), TODAY);
    const ev = evaluatePurchase(a.snapshot, a.reserve, { item: "TV", price: 9000, method: "avista", installments: 1, monthlyInterestPct: 0, cashDiscountPct: 0, need: "desejo" });
    expect(ev.verdict).toBe("nao_recomendada");
  });
  it("compra pequena com folga é confortável", () => {
    const txs = ["2026-09", "2026-10"].map((m) => tx({ amount: 2500, occurred_on: `${m}-05`, is_essential: true, category_id: "c-aluguel" }));
    const a = analyze(baseData({ transactions: txs }), TODAY);
    const ev = evaluatePurchase(a.snapshot, a.reserve, { item: "Fone", price: 300, method: "avista", installments: 1, monthlyInterestPct: 0, cashDiscountPct: 0, need: "melhoria" });
    expect(ev.verdict).toBe("confortavel");
  });
  it("compara à vista com desconto x parcelado sem juros", () => {
    const r = compareCashVsInstallments(3000, 10, 10, 0, 0.9);
    expect(r.cashPrice).toBe(2700);
    expect(r.bestOption).toBe("avista");
    const r2 = compareCashVsInstallments(3000, 0, 10, 0, 0.9);
    expect(r2.bestOption).toBe("parcelado");
  });
});

describe("metas", () => {
  it("detecta meta atrasada e sugere ajustes", () => {
    const g = analyzeGoal({ id: "g", name: "Viagem", type: "viagem", target_amount: 12000, current_amount: 2000, deadline: "2027-11-30", priority: 2, monthly_contribution: 500, horizon: "curto", status: "ativa" }, TODAY);
    expect(g.monthsLeft).toBe(12);
    expect(g.requiredMonthly).toBeCloseTo(833.33, 2);
    expect(g.status).toBe("atrasada");
    expect(g.projectedMonths).toBe(20);
    expect(g.suggestions.length).toBe(3);
  });
});

describe("projeções", () => {
  it("gera série com patrimônio crescente quando há sobra", () => {
    const data = baseData({ transactions: [tx({ amount: 3000, occurred_on: "2026-10-05", is_essential: true })] });
    const s = buildSnapshot(data, TODAY);
    const p = project(s, data.debts, data.incomes, DEFAULT_SCENARIOS.realista, 12);
    expect(p).toHaveLength(13);
    expect(p[12].netWorth).toBeGreaterThan(p[0].netWorth);
  });
});

describe("regressões", () => {
  it("conta paga no início do mês não gera alerta de crescimento", () => {
    const txs = ["2026-08", "2026-09", "2026-10", "2026-11"].map((m) =>
      tx({ amount: 1500, occurred_on: `${m}-02`, category_id: "c-aluguel", is_essential: true, recurrence: "mensal", description: "Aluguel" }));
    const a = analyze(baseData({ transactions: txs }), TODAY);
    expect(a.insights.some((i) => i.id.startsWith("cresc_"))).toBe(false);
  });
  it("reserva aplicada em investimento conta como liquidez e não duplica em investimentos", () => {
    const data = baseData();
    data.assets.push({ id: "a4", name: "CDB reserva", type: "investimento", value: 5000, institution: null, is_emergency_reserve: true, notes: null });
    const s = buildSnapshot(data, TODAY);
    expect(s.assets.reserve).toBe(17000);
    expect(s.assets.liquid).toBe(21000);
    expect(s.assets.investments).toBe(0);
  });
});

describe("validação de lançamentos", () => {
  it("aceita despesa à vista sem informar parcelas nem cartão (campos ocultos)", async () => {
    const { schemas } = await import("@/lib/validation/schemas");
    const r = schemas.transactions.parse({
      kind: "expense", description: "Mercado", amount: 450.9, occurred_on: "2026-11-06", payment_method: "pix",
      recurrence: "nenhuma", is_essential: true, category_id: "00000000-0000-4000-8000-000000000007",
    });
    expect(r.installments).toBe(1);
    expect(r.card_id).toBeNull();
  });
});

describe("início do recebimento integral", () => {
  it("antes do primeiro mês integral, só contam as receitas lançadas", () => {
    const data = baseData({
      transactions: [tx({ kind: "income", amount: 2985.26, occurred_on: "2026-11-03", description: "Salário proporcional" })],
    });
    data.incomes[0].starts_on = "2026-12-01";
    const s = buildSnapshot(data, TODAY);
    expect(s.month.income).toBe(2985.26);
    expect(s.income.monthlyNet).toBe(6000); // referência para planejamento continua cheia
    data.incomes[0].starts_on = "2026-11-01";
    expect(buildSnapshot(data, TODAY).month.income).toBe(8985.26);
  });
});

describe("cenário de despesa médica", () => {
  it("com plano de saúde considera só o que o plano não cobre", async () => {
    const { stressTest } = await import("./reserve");
    const s = buildSnapshot(baseData(), TODAY);
    expect(stressTest(s).find((c) => c.key === "medica")!.upfrontCost).toBe(5000);
    expect(stressTest(s, { hasHealthPlan: true }).find((c) => c.key === "medica")!.upfrontCost).toBe(1000);
  });
});
