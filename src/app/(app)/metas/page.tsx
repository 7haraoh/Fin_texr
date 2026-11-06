import { loadAnalysis } from "@/lib/data";
import { brl, dateBR, monthsText, pct } from "@/lib/finance/format";
import { monthLabel } from "@/lib/finance/dates";
import { goalProjection } from "@/lib/finance/goals";
import { Badge, Card, Notice, PageHeader, Progress, Stat } from "@/components/ui";
import { GoalsSection } from "@/components/goals";
import { Lines } from "@/components/charts";

export const metadata = { title: "Metas" };

const STATUS: Record<string, { label: string; tone: "pos" | "warn" | "neg" | "neutral" | "info" }> = {
  concluida: { label: "Concluída", tone: "pos" }, no_ritmo: { label: "No ritmo", tone: "pos" },
  atrasada: { label: "Fora do ritmo", tone: "warn" }, sem_aporte: { label: "Sem aporte", tone: "neg" }, sem_prazo: { label: "Sem prazo", tone: "info" },
};

export default async function Metas() {
  const { data, analysis, today } = await loadAnalysis();
  const { goals, feasibility, snapshot: s } = analysis;
  const active = goals.filter((g) => g.goal.status === "ativa");
  return (
    <>
      <PageHeader title="Metas e objetivos" subtitle="O sistema avalia se cada meta cabe na sua renda e sugere ajustes de prazo, valor ou aporte." />
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Metas ativas" value={String(active.length)} />
        <Stat label="Aportes planejados" value={brl(feasibility.totalPlanned)} hint="por mês" />
        <Stat label="Aportes necessários" value={brl(feasibility.totalRequired)} hint="para cumprir os prazos" />
        <Stat label="Capacidade de economia" value={brl(s.savingsCapacity)} estimate tone={s.savingsCapacity < 0 ? "neg" : undefined} />
      </div>
      {active.length > 0 && <div className="mb-6"><Notice tone={feasibility.feasible ? "info" : "warn"}>{feasibility.message}</Notice></div>}

      <Card title="Minhas metas"><GoalsSection rows={data.goals} /></Card>

      {active.length > 0 && (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {active.map((g) => {
            const series = goalProjection(g, today).map((p) => ({ label: monthLabel(p.key), acumulado: p.value }));
            return (
              <Card key={g.goal.id} title={g.goal.name} subtitle={`${brl(g.current)} de ${brl(g.target)}${g.goal.deadline ? ` · prazo ${dateBR(g.goal.deadline)}` : ""}`}
                action={<Badge tone={STATUS[g.status].tone}>{STATUS[g.status].label}</Badge>}>
                <Progress value={g.progress} tone="pos" />
                <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                  <div><div className="text-faint">Falta</div><div className="num font-medium">{brl(g.remaining)}</div></div>
                  <div><div className="text-faint">Aporte planejado</div><div className="num font-medium">{brl(g.planned)}</div></div>
                  <div><div className="text-faint">Necessário/mês</div><div className="num font-medium">{g.requiredMonthly !== null ? brl(g.requiredMonthly) : "—"}</div></div>
                </div>
                <p className="mt-2 text-xs text-muted">
                  {g.projectedMonths !== null ? `No ritmo atual, conclui em ${monthsText(g.projectedMonths)} (${g.projectedDate ? monthLabel(g.projectedDate) : ""}).` : "Defina um aporte mensal para projetar a conclusão."}
                  {s.savingsCapacity > 0 && g.planned > 0 && ` Usa ${pct(g.planned / s.savingsCapacity)} da sua capacidade de economia.`}
                </p>
                {g.suggestions.length > 0 && <ul className="mt-2 list-disc space-y-0.5 pl-4 text-xs text-warn">{g.suggestions.map((t, i) => <li key={i}>{t}</li>)}</ul>}
                {g.planned > 0 && g.remaining > 0 && <div className="mt-3"><Lines data={series} series={[{ key: "acumulado", name: "Acumulado projetado" }]} area height={150} /></div>}
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
