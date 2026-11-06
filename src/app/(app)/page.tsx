import Link from "next/link";
import { ArrowRight, CircleCheck, Lightbulb, TriangleExclamationPoint, OctagonExclamationPoint, Info } from "lucide-react";
import { loadAnalysis, recordMonthlySnapshot } from "@/lib/data";
import { brl, dateBR, pct } from "@/lib/finance/format";
import { monthLabel, monthLabelFull } from "@/lib/finance/dates";
import { HEALTH_LABELS, type HealthLevel } from "@/lib/finance/health";
import { ALLOCATION_LABELS, ALLOCATION_ORDER } from "@/lib/finance/budget";
import type { Insight } from "@/lib/finance/insights";
import { Badge, Card, EmptyState, PageHeader, Progress, Stat, cx } from "@/components/ui";
import { Donut, GroupedBars, Lines, SignedBars } from "@/components/charts";

export const metadata = { title: "Minha saúde financeira" };

const LEVEL_STYLE: Record<HealthLevel, { color: string; text: string }> = {
  excelente: { color: "var(--pos)", text: "Sua base financeira é sólida. Mantenha a disciplina e direcione sobras para metas de longo prazo." },
  saudavel: { color: "var(--pos)", text: "Situação equilibrada, com pontos específicos a fortalecer." },
  atencao: { color: "var(--warn)", text: "Há fragilidades que merecem ação nos próximos meses." },
  risco: { color: "var(--neg)", text: "Sua estabilidade está ameaçada. Priorize os alertas abaixo." },
  critico: { color: "var(--neg)", text: "Situação crítica: foque em estancar perdas e evitar novas dívidas." },
};

function InsightIcon({ i }: { i: Insight }) {
  if (i.kind === "positivo") return <CircleCheck size={16} className="text-pos" />;
  if (i.kind === "oportunidade") return <Lightbulb size={16} className="text-info" />;
  if (i.severity === "critico") return <OctagonExclamationPoint size={16} className="text-neg" />;
  if (i.severity === "alto") return <TriangleExclamationPoint size={16} className="text-neg" />;
  if (i.severity === "medio") return <TriangleExclamationPoint size={16} className="text-warn" />;
  return <Info size={16} className="text-muted" />;
}

export default async function Dashboard() {
  await recordMonthlySnapshot().catch(() => undefined);
  const { data, analysis, today } = await loadAnalysis();
  const { snapshot: s, health, insights, suggestion, budget } = analysis;
  const onboarding = [
    { done: s.dataQuality.hasIncome, label: "Cadastrar renda", href: "/perfil" },
    { done: s.dataQuality.hasAssets, label: "Informar saldos e patrimônio", href: "/perfil#patrimonio" },
    { done: s.dataQuality.hasDebtsInfo, label: "Registrar cartões e dívidas (se houver)", href: "/perfil#obrigacoes" },
    { done: s.dataQuality.hasExpenses, label: "Lançar despesas", href: "/despesas" },
    { done: data.goals.length > 0, label: "Definir metas", href: "/metas" },
    { done: Object.keys(data.profile?.lifestyle ?? {}).length > 2, label: "Contar sobre seu estilo de vida", href: "/perfil#estilo" },
  ];
  const pending = onboarding.filter((o) => !o.done);

  // Evolução registrada (fotografias mensais), incluindo o mês atual
  const snaps = new Map(data.snapshots.map((r) => [r.month.slice(0, 7), r]));
  const nwSeries = [...snaps.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, r]) => ({
    label: monthLabel(k),
    patrimonio: k === s.monthKey ? s.netWorth : Number(r.net_worth),
    reserva: k === s.monthKey ? s.assets.reserve : Number(r.emergency_reserve),
  }));
  if (!snaps.has(s.monthKey)) nwSeries.push({ label: monthLabel(s.monthKey), patrimonio: s.netWorth, reserva: s.assets.reserve });

  // Só a partir do primeiro mês com lançamentos (antes disso não há registro)
  const firstData = s.history.findIndex((h) => h.hasData);
  const flows = s.history.slice(firstData < 0 ? s.history.length - 1 : firstData).map((h) => ({ label: h.label, receitas: h.income, despesas: h.expenses, economia: h.savings }));
  const allocation = budget ? Object.fromEntries(budget.map((b) => [b.key, b.planned])) : suggestion.allocations;
  const income = s.income.monthlyNet;
  const reserveCoverage = analysis.reserve.coverageMonths;

  return (
    <>
      <PageHeader title="Minha saúde financeira" subtitle={`${monthLabelFull(s.monthKey)} · atualizado em ${dateBR(today)}`} />

      {pending.length > 0 && (
        <Card className="mb-6" title="Complete seu perfil para análises mais precisas" subtitle="Quanto mais informações, mais contextualizadas ficam as recomendações.">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {onboarding.map((o) => (
              <Link key={o.label} href={o.href} className={cx("flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm hover:bg-surface-2", o.done && "opacity-60")}>
                <CircleCheck size={16} className={o.done ? "text-pos" : "text-faint"} />
                <span className={cx(o.done && "line-through")}>{o.label}</span>
                {!o.done && <ArrowRight size={14} className="ml-auto text-faint" />}
              </Link>
            ))}
          </div>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Indicador de saúde financeira" subtitle="Considera renda, gastos, dívidas, liquidez, reserva e metas">
          {health.score === null ? (
            <EmptyState title="Dados insuficientes" text={health.insufficient.join(" · ")} href="/perfil" cta="Completar perfil" />
          ) : (
            <div>
              <div className="flex items-end gap-3">
                <span className="num text-5xl font-semibold tracking-tight" style={{ color: LEVEL_STYLE[health.level!].color }}>{health.score}</span>
                <div className="pb-1.5">
                  <div className="text-lg font-semibold" style={{ color: LEVEL_STYLE[health.level!].color }}>{HEALTH_LABELS[health.level!]}</div>
                  <div className="text-xs text-faint">de 100 pontos{s.dataQuality.completeMonths === 0 && " · prévia"}</div>
                </div>
              </div>
              <div className="mt-3 flex gap-1" aria-hidden>
                {(["critico", "risco", "atencao", "saudavel", "excelente"] as HealthLevel[]).map((l) => (
                  <div key={l} className="h-1.5 flex-1 rounded-full" style={{ background: l === health.level ? LEVEL_STYLE[l].color : "var(--surface-2)" }} />
                ))}
              </div>
              <p className="mt-3 text-sm text-muted">{LEVEL_STYLE[health.level!].text}</p>
              {s.dataQuality.completeMonths === 0 && <p className="mt-2 text-xs text-warn">Prévia baseada no mês atual incompleto. A nota fica mais precisa após o primeiro mês completo de lançamentos.</p>}
              <ul className="mt-4 space-y-2.5">
                {health.components.map((c) => (
                  <li key={c.key}>
                    <div className="mb-1 flex justify-between text-xs"><span className="font-medium">{c.label}</span><span className="text-faint">{Math.round(c.score * 100)}/100</span></div>
                    <Progress value={c.score} tone={c.score >= 0.65 ? "pos" : c.score >= 0.4 ? "warn" : "neg"} />
                    <div className="mt-0.5 text-[11px] text-faint">{c.detail}</div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>

        <div className="grid grid-cols-2 gap-3 lg:col-span-2 xl:grid-cols-3">
          <Stat label="Patrimônio líquido" value={brl(s.netWorth)} hint={`Ativos ${brl(s.assets.total)} − dívidas ${brl(s.debts.totalOutstanding)}`} tone={s.netWorth < 0 ? "neg" : undefined} />
          <Stat label="Saldo disponível" value={brl(s.assets.available)} hint="Contas e espécie, fora a reserva" />
          <Stat label="Renda mensal líquida" value={brl(income)} hint={s.month.extraIncome ? `+ ${brl(s.month.extraIncome)} extras no mês` : `${pct(s.income.stableShare)} estável`} />
          <Stat label="Despesas do mês" value={brl(s.month.expenses)} hint={`Fixas ${brl(s.month.fixed)} · variáveis ${brl(s.month.variable)}`} />
          <Stat label="Comprometido com dívidas" value={brl(s.debts.monthlyPayments + (s.futureCommitments[0]?.cards ?? 0))} hint={`Parcelas ${brl(s.debts.monthlyPayments)} + faturas ${brl(s.futureCommitments[0]?.cards ?? 0)} no mês`} tone={s.debtRatio > 0.3 ? "neg" : undefined} />
          <Stat label="Economizado no mês" value={brl(s.month.savings)} estimate hint="Renda − despesas − parcelas" tone={s.month.savings < 0 ? "neg" : "pos"} />
          <Stat label="Renda comprometida" value={pct(s.commitmentRatio)} hint="Gastos fixos + parcelas ÷ renda" tone={s.commitmentRatio > 0.7 ? "neg" : s.commitmentRatio > 0.5 ? "warn" : undefined} />
          <Stat label="Reserva de emergência" value={brl(s.assets.reserve)} hint={`${reserveCoverage.toLocaleString("pt-BR")} meses de essenciais`} tone={reserveCoverage < 3 ? "warn" : "pos"} />
          <Stat label="Livre para gastar" value={brl(Math.max(0, s.freeToSpend.monthRemaining))} estimate
            hint={s.freeToSpend.monthRemaining < 0 ? `Orçamento estourado em ${brl(-s.freeToSpend.monthRemaining)}` : `≈ ${brl(s.freeToSpend.perDay)}/dia por ${s.freeToSpend.remainingDays} dias`}
            tone={s.freeToSpend.monthRemaining < 0 ? "neg" : undefined} />
        </div>
      </div>

      <Card className="mt-6" title="Principais problemas e oportunidades" subtitle="Identificados automaticamente a partir dos seus dados — converse com o consultor para aprofundar">
        {insights.length === 0 ? (
          <p className="text-sm text-muted">Nenhum alerta relevante no momento. 👏</p>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {insights.map((i) => (
              <li key={i.id} className="flex gap-3 rounded-lg border border-line p-3">
                <span className="mt-0.5"><InsightIcon i={i} /></span>
                <div className="min-w-0">
                  <div className="text-sm font-medium">{i.title}</div>
                  <div className="mt-0.5 text-xs text-muted">{i.detail}</div>
                  {i.href && <Link href={i.href} className="mt-1 inline-block text-xs font-medium text-accent">Ver detalhes →</Link>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card title="Receitas × despesas" subtitle="Últimos 6 meses · receita = renda recorrente cadastrada + extras">
          <GroupedBars data={flows} series={[{ key: "receitas", name: "Receitas" }, { key: "despesas", name: "Despesas" }]} />
        </Card>
        <Card title="Gastos por categoria" subtitle={`Mês atual · ${brl(s.month.expenses)}`}>
          {s.categories.filter((c) => c.thisMonth > 0).length === 0
            ? <EmptyState title="Sem despesas neste mês" href="/despesas" cta="Lançar despesa" />
            : <Donut items={s.categories.filter((c) => c.thisMonth > 0).map((c) => ({ name: c.name, value: c.thisMonth }))} />}
        </Card>
        <Card title="Evolução da economia mensal" subtitle="Estimativa: renda − despesas − parcelas">
          <SignedBars data={flows} dataKey="economia" name="Economia" />
        </Card>
        <Card title="Destino da renda" subtitle={budget ? "Plano de orçamento do mês" : "Sugestão personalizada (salve em Orçamento)"}>
          {income <= 0 ? <EmptyState title="Cadastre sua renda" href="/perfil" cta="Ir ao perfil" /> : (
            <ul className="space-y-2.5">
              {ALLOCATION_ORDER.map((k) => {
                const v = Number(allocation[k] ?? 0);
                return (
                  <li key={k}>
                    <div className="mb-1 flex justify-between text-xs"><span>{ALLOCATION_LABELS[k]}</span><span className="num text-muted">{brl(v)} · {pct(v / income)}</span></div>
                    <Progress value={v / income} tone="pos" />
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
        <Card title="Evolução patrimonial" subtitle="Registrada mês a mês a partir dos seus saldos cadastrados">
          {nwSeries.length < 2
            ? <div><div className="num text-2xl font-semibold">{brl(s.netWorth)}</div><p className="mt-1 text-xs text-muted">O histórico é construído automaticamente a cada mês. Volte nos próximos meses para ver a evolução.</p></div>
            : <Lines data={nwSeries} series={[{ key: "patrimonio", name: "Patrimônio líquido" }]} area />}
        </Card>
        <Card title="Evolução da reserva de emergência" subtitle={`Meta recomendada: ${brl(analysis.reserve.recommended)} (${analysis.reserve.recommendedMonths} meses)`}>
          {nwSeries.length < 2
            ? <div><div className="num text-2xl font-semibold">{brl(s.assets.reserve)}</div><div className="mt-3"><Progress value={analysis.reserve.recommended ? s.assets.reserve / analysis.reserve.recommended : 0} /></div><p className="mt-2 text-xs text-muted">Marque contas como “reserva de emergência” no Perfil para acompanhá-la.</p></div>
            : <Lines data={nwSeries} series={[{ key: "reserva", name: "Reserva" }]} area />}
          <div className="mt-2 flex justify-end"><Badge tone={reserveCoverage >= analysis.reserve.recommendedMonths ? "pos" : reserveCoverage >= 3 ? "warn" : "neg"}>{reserveCoverage.toLocaleString("pt-BR")} de {analysis.reserve.recommendedMonths} meses</Badge></div>
        </Card>
      </div>
    </>
  );
}
