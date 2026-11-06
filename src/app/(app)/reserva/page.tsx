import { loadAnalysis } from "@/lib/data";
import { stressTest } from "@/lib/finance/reserve";
import { brl, monthsText } from "@/lib/finance/format";
import { Badge, Card, EmptyState, Notice, PageHeader, Progress, Stat, cx } from "@/components/ui";

export const metadata = { title: "Reserva e proteção" };

export default async function Reserva() {
  const { analysis } = await loadAnalysis();
  const { reserve: r, snapshot: s } = analysis;
  const scenarios = stressTest(s);
  if (r.essentialMonthly <= 0) {
    return (
      <>
        <PageHeader title="Reserva de emergência e proteção" />
        <EmptyState title="Ainda não há dados para calcular o custo essencial" text="Lance despesas marcando as essenciais (moradia, alimentação básica, saúde, transporte) e cadastre suas dívidas." href="/despesas" cta="Lançar despesas" />
      </>
    );
  }
  return (
    <>
      <PageHeader title="Reserva de emergência e proteção" subtitle="Calculada a partir do seu custo mensal essencial — não do total de gastos." />
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Custo essencial mensal" value={brl(r.essentialMonthly)} hint="Essenciais + parcelas de dívidas" estimate />
        <Stat label="Reserva atual" value={brl(r.current)} hint="Ativos marcados como reserva" />
        <Stat label="Cobertura" value={monthsText(r.coverageMonths)} tone={r.coverageMonths < 3 ? "warn" : "pos"} hint="das despesas essenciais" />
        <Stat label="Falta para a meta" value={brl(r.gap)} hint={r.monthsToRecommended !== null ? `≈ ${monthsText(r.monthsToRecommended)} com ${brl(r.monthlyContribution)}/mês` : "Defina um aporte mensal"} />
      </div>
      <div className="mb-6"><Notice>{r.rationale} Mantenha a reserva em aplicações de baixo risco e liquidez imediata; ela não é dinheiro para consumo nem para investimentos de risco.</Notice></div>

      <div className="grid gap-4 md:grid-cols-3">
        {r.targets.map((t) => (
          <Card key={t.months} title={`${t.months} meses`} action={t.months === r.recommendedMonths ? <Badge tone="pos">Recomendado</Badge> : undefined}>
            <div className="num text-2xl font-semibold">{brl(t.amount)}</div>
            <div className="mt-3"><Progress value={t.amount ? r.current / t.amount : 0} tone="pos" /></div>
            <div className="mt-2 text-xs text-muted">{t.gap === 0 ? "Meta atingida ✓" : `Faltam ${brl(t.gap)}${t.monthsToReach !== null ? ` · ${monthsText(t.monthsToReach)}` : ""}`}</div>
          </Card>
        ))}
      </div>

      <Card className="mt-6" title="Simulação de situações adversas" subtitle="Por quanto tempo você mantém o padrão essencial de vida usando reserva, saldos e investimentos (sem vender bens)">
        <div className="-mx-5 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead><tr className="border-b border-line text-left text-xs text-faint">
              <th className="px-5 py-2 font-medium">Cenário</th><th className="px-5 py-2 text-right font-medium">Renda no cenário</th>
              <th className="px-5 py-2 text-right font-medium">Custo imediato</th><th className="px-5 py-2 text-right font-medium">Déficit mensal</th>
              <th className="px-5 py-2 text-right font-medium">Sustentação</th>
            </tr></thead>
            <tbody>
              {scenarios.map((c) => {
                const tone = c.survivalMonths === null || c.survivalMonths >= 6 ? "text-pos" : c.survivalMonths >= 3 ? "text-warn" : "text-neg";
                return (
                  <tr key={c.key} className="border-b border-line/60 last:border-0 align-top">
                    <td className="px-5 py-2.5"><div className="font-medium">{c.label}</div><div className="text-xs text-faint">{c.description}</div><div className="mt-1 text-xs text-muted">{c.verdict}</div></td>
                    <td className="num px-5 py-2.5 text-right">{brl(c.monthlyIncome)}</td>
                    <td className="num px-5 py-2.5 text-right">{c.upfrontCost ? brl(c.upfrontCost) : "—"}</td>
                    <td className="num px-5 py-2.5 text-right">{c.monthlyBurn ? brl(c.monthlyBurn) : "—"}</td>
                    <td className={cx("num px-5 py-2.5 text-right font-semibold", tone)}>{c.survivalMonths === null ? "Indefinida" : monthsText(c.survivalMonths)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-faint">Estimativas. Investimentos são considerados a 90% do valor (possíveis perdas, prazos e impostos). Peça ao consultor para simular valores diferentes.</p>
      </Card>
    </>
  );
}
