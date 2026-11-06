import { loadAnalysis } from "@/lib/data";
import { brl, pct } from "@/lib/finance/format";
import { monthLabelFull } from "@/lib/finance/dates";
import { Card, PageHeader, Stat } from "@/components/ui";
import { PrintButton } from "@/components/print-button";

export const metadata = { title: "Relatório mensal" };

export default async function Relatorio() {
  const { analysis } = await loadAnalysis();
  const { snapshot: s, insights, goals, health, reserve } = analysis;
  const cur = s.month;
  const prev = s.history[s.history.length - 2];
  const savingsPct = cur.income > 0 ? cur.savings / cur.income : 0;
  const good = insights.filter((i) => i.kind === "positivo").map((i) => i.title);
  if (s.savingsCapacity > 0) good.push(`Capacidade de economia positiva de ${brl(s.savingsCapacity)}/mês`);
  if (prev?.hasData && cur.expenses < prev.expenses) good.push(`Despesas ${pct(1 - cur.expenses / prev.expenses)} menores que no mês anterior (até agora)`);
  const improve = insights.filter((i) => i.kind === "alerta").map((i) => `${i.title} — ${i.detail}`);
  const risks = insights.filter((i) => i.kind === "risco").map((i) => `${i.title} — ${i.detail}`);
  const opps = insights.filter((i) => i.kind === "oportunidade").map((i) => `${i.title} — ${i.detail}`);
  const priorities: string[] = [];
  if (s.debts.lateCount) priorities.push("Regularizar dívidas e faturas em atraso.");
  if (s.savingsCapacity < 0) priorities.push("Equilibrar o orçamento: gastos de referência acima da renda.");
  if (reserve.coverageMonths < 3) priorities.push(`Fortalecer a reserva de emergência (faltam ${brl(reserve.gap)}).`);
  if (s.debtRatio > 0.3) priorities.push("Não assumir novas parcelas e acelerar a quitação das dívidas mais caras.");
  goals.filter((g) => g.status === "atrasada").slice(0, 2).forEach((g) => priorities.push(`Revisar a meta "${g.goal.name}": ${g.suggestions[0] ?? "ajustar prazo ou aporte"}.`));
  if (!priorities.length) priorities.push("Manter a disciplina e direcionar sobras para metas e investimentos de longo prazo.");

  const List = ({ items, empty }: { items: string[]; empty: string }) =>
    items.length ? <ul className="list-disc space-y-1 pl-4 text-sm text-muted">{items.map((t, i) => <li key={i}>{t}</li>)}</ul> : <p className="text-sm text-faint">{empty}</p>;

  return (
    <>
      <PageHeader title="Relatório mensal" subtitle={`${monthLabelFull(s.monthKey)} · parcial até hoje`} actions={<PrintButton />} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Receitas" value={brl(cur.income)} hint={prev ? `Mês anterior: ${brl(prev.income)}` : undefined} />
        <Stat label="Despesas" value={brl(cur.expenses)} hint={prev ? `Mês anterior: ${brl(prev.expenses)}` : undefined} />
        <Stat label="Economia" value={brl(cur.savings)} hint={`${pct(savingsPct)} da renda`} estimate tone={cur.savings < 0 ? "neg" : "pos"} />
        <Stat label="Saúde financeira" value={health.score === null ? "—" : `${health.score} · ${health.label}`} />
        <Stat label="Patrimônio líquido" value={brl(s.netWorth)} />
        <Stat label="Dívidas" value={brl(s.debts.totalOutstanding)} />
        <Stat label="Reserva" value={brl(s.assets.reserve)} hint={`${reserve.coverageMonths.toLocaleString("pt-BR")} meses`} />
        <Stat label="Metas no ritmo" value={`${goals.filter((g) => g.onTrack && g.goal.status === "ativa").length}/${goals.filter((g) => g.goal.status === "ativa").length}`} />
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Card title="Comparativo com meses anteriores">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-faint"><th className="py-1 font-medium">Mês</th><th className="py-1 text-right font-medium">Receitas</th><th className="py-1 text-right font-medium">Despesas</th><th className="py-1 text-right font-medium">Economia</th></tr></thead>
            <tbody>{s.history.map((h) => (
              <tr key={h.key} className="border-t border-line/60"><td className="py-1.5">{h.label}</td><td className="num py-1.5 text-right">{brl(h.income)}</td><td className="num py-1.5 text-right">{brl(h.expenses)}</td><td className="num py-1.5 text-right">{brl(h.savings)}</td></tr>
            ))}</tbody>
          </table>
        </Card>
        <Card title="Categorias com maior consumo">
          <List items={s.categories.slice(0, 6).map((c) => `${c.name}: ${brl(c.thisMonth)}${c.average ? ` (média ${brl(c.average)})` : ""}`)} empty="Sem despesas no mês." />
        </Card>
        <Card title="O que foi bem"><List items={good} empty="Registre mais dados para identificar pontos positivos." /></Card>
        <Card title="O que precisa melhorar"><List items={improve} empty="Nada relevante." /></Card>
        <Card title="Riscos identificados"><List items={risks} empty="Nenhum risco relevante." /></Card>
        <Card title="Oportunidades"><List items={opps} empty="Nenhuma oportunidade destacada." /></Card>
        <Card title="Prioridades para o próximo mês" className="md:col-span-2"><List items={priorities} empty="" /></Card>
      </div>
      <p className="mt-6 text-xs text-faint">Relatório gerado por regras determinísticas a partir dos dados cadastrados. Para uma análise comentada, peça ao consultor IA: “Faça meu relatório do mês”.</p>
    </>
  );
}
