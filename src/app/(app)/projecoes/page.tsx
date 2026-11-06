import { loadAnalysis } from "@/lib/data";
import { DEFAULT_SCENARIOS, SCENARIO_LABELS, project, type ScenarioKey } from "@/lib/finance/projection";
import { brl } from "@/lib/finance/format";
import { Card, Notice, PageHeader } from "@/components/ui";
import { Lines } from "@/components/charts";

export const metadata = { title: "Projeções" };
const HORIZONS = [6, 12, 36, 60];
const KEYS: ScenarioKey[] = ["conservador", "realista", "otimista"];

export default async function Projecoes() {
  const { data, analysis } = await loadAnalysis();
  const s = analysis.snapshot;
  const series = Object.fromEntries(KEYS.map((k) => [k, project(s, data.debts, data.incomes, DEFAULT_SCENARIOS[k], 60)])) as Record<ScenarioKey, ReturnType<typeof project>>;
  const chart = series.realista.map((p, i) => ({ label: p.label, conservador: series.conservador[i].netWorth, realista: p.netWorth, otimista: series.otimista[i].netWorth }));

  return (
    <>
      <PageHeader title="Projeções e cenários" subtitle="Simulação do futuro a partir dos seus dados atuais." />
      <div className="mb-6"><Notice tone="warn">Todos os valores desta tela são <strong>estimativas</strong> baseadas nas premissas abaixo — não são valores registrados nem garantia de resultado. Ponto de partida registrado: patrimônio líquido de <strong>{brl(s.netWorth)}</strong>, renda de {brl(s.income.monthlyNet)} e gastos de referência de {brl(s.baseline.expenses)}/mês.</Notice></div>

      <Card title="Patrimônio líquido projetado (5 anos)">
        <Lines data={chart} series={[{ key: "conservador", name: "Conservador" }, { key: "realista", name: "Realista" }, { key: "otimista", name: "Otimista" }]} height={300} />
      </Card>

      <Card className="mt-6" title="Resultados por horizonte">
        <div className="-mx-5 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead><tr className="border-b border-line text-left text-xs text-faint">
              <th className="px-5 py-2 font-medium">Cenário</th>
              {HORIZONS.map((h) => <th key={h} className="px-5 py-2 text-right font-medium">{h < 12 ? `${h} meses` : `${h / 12} ano${h > 12 ? "s" : ""}`}</th>)}
            </tr></thead>
            <tbody>
              {KEYS.map((k) => (
                <tr key={k} className="border-b border-line/60 last:border-0">
                  <td className="px-5 py-2.5 font-medium">{SCENARIO_LABELS[k]}</td>
                  {HORIZONS.map((h) => {
                    const p = series[k][h];
                    return <td key={h} className="num px-5 py-2.5 text-right"><div>{brl(p.netWorth)}</div><div className="text-[11px] text-faint">economia {brl(p.savings)}/mês</div></td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="mt-6" title="Premissas">
        <div className="grid gap-4 md:grid-cols-3">
          {KEYS.map((k) => {
            const a = DEFAULT_SCENARIOS[k];
            return (
              <div key={k} className="rounded-lg border border-line p-3 text-sm">
                <div className="font-medium">{SCENARIO_LABELS[k]}</div>
                <ul className="mt-2 space-y-1 text-xs text-muted">
                  <li>Crescimento da renda: {(a.incomeGrowthYear * 100).toFixed(1)}% a.a.</li>
                  <li>Inflação das despesas: {(a.inflationYear * 100).toFixed(1)}% a.a.</li>
                  <li>Rentabilidade da carteira líquida: {(a.returnYear * 100).toFixed(1)}% a.a.</li>
                  <li>Reajustes cadastrados na renda: {a.applyExpectedChanges ? "considerados" : "ignorados"}</li>
                </ul>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-faint">Dívidas são amortizadas pelas parcelas até o fim do prazo informado, liberando fluxo de caixa. Bens (imóveis, veículos) são mantidos pelo valor atual, sem valorização ou depreciação.</p>
      </Card>
    </>
  );
}
