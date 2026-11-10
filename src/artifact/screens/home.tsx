import { ChevronRight, Sparkles, TriangleExclamationPoint, OctagonExclamationPoint, Lightbulb, CircleCheck } from "lucide-react";
import { brl, dateBR } from "@/lib/finance/format";
import { monthLabelFull, monthLabel } from "@/lib/finance/dates";
import { num, round2 } from "@/lib/finance/types";
import { cx } from "@/components/ui";
import { analysisNow } from "../data-shim";
import { navigate } from "../router";
import { upcomingBills } from "../upcoming";
import { Amount, CatIcon, Panel, Row, Section } from "./common";

const DOW = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const dayChip = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return { day: d, dow: DOW[new Date(Date.UTC(y, m - 1, d)).getUTCDay()] };
};

export function Home() {
  const { data, analysis: a, today } = analysisNow();
  const s = a.snapshot;
  const name = data.profile?.full_name?.split(" ")[0];
  // Benefícios de uso restrito (vale alimentação) não são dinheiro livre: ficam de fora do número principal
  const benefit = data.incomes.filter((i) => i.active && i.type === "beneficio").reduce((t, i) => t + num(i.net_amount), 0);
  const free = round2(s.freeToSpend.monthRemaining - benefit);
  const perDay = round2(Math.max(0, free) / s.freeToSpend.remainingDays);
  const spentShare = s.month.income > 0 ? Math.min(1, (s.month.expenses + s.debts.monthlyPayments) / s.month.income) : 0;
  const bills = upcomingBills(data, a, today, 40).slice(0, 6);
  const billsTotal = bills.reduce((t, b) => t + b.amount, 0);
  const goals = a.goals.filter((g) => g.goal.status === "ativa").slice(0, 3);
  const alert = a.insights.find((i) => i.kind !== "positivo") ?? a.insights[0];
  const catById = new Map(data.categories.map((c) => [c.id, c]));
  const recent = data.transactions.filter((t) => t.occurred_on <= today).slice(0, 5);

  if (!s.dataQuality.hasIncome) {
    return (
      <div className="space-y-6 pt-2">
        <h1 className="text-[28px] font-semibold tracking-tight">Olá{name ? `, ${name}` : ""}</h1>
        <Panel className="p-5">
          <p className="text-[15px]">Comece cadastrando sua renda e seus saldos. Em poucos minutos o app já mostra quanto você pode gastar.</p>
          <button onClick={() => navigate("/perfil")} className="mt-4 text-[15px] font-semibold text-accent">Abrir perfil financeiro →</button>
        </Panel>
      </div>
    );
  }

  return (
    <div className="space-y-7 pt-1">
      <header>
        <p className="text-[13px] font-medium text-muted first-letter:uppercase">{monthLabelFull(s.monthKey)}</p>
        <h1 className="text-[28px] font-semibold tracking-tight">Olá{name ? `, ${name}` : ""}</h1>
      </header>

      <Panel className="hero p-5">
        <p className="text-[13px] font-medium text-muted">Livre para gastar este mês</p>
        <p className={cx("num mt-1 text-[44px] font-semibold leading-none tracking-tight", free < 0 && "text-neg")}>{brl(free)}</p>
        <p className="mt-2 text-[14px] text-muted">
          {free > 0 ? <>≈ <span className="num font-medium text-fg">{brl(perDay)}</span> por dia · {s.freeToSpend.remainingDays} dias restantes</> : "Seu orçamento do mês já está comprometido."}
        </p>
        <div className="mt-5">
          <div className="flex justify-between text-[12px] text-muted"><span>Usado da renda do mês</span><span className="num">{Math.round(spentShare * 100)}%</span></div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full bg-accent" style={{ width: `${spentShare * 100}%` }} /></div>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-3 border-t border-line pt-4 text-[12px]">
          <div><div className="text-muted">Receita</div><div className="num mt-0.5 text-[15px] font-semibold">{brl(s.month.income)}</div></div>
          <div><div className="text-muted">Gastos</div><div className="num mt-0.5 text-[15px] font-semibold">{brl(s.month.expenses)}</div></div>
          <div><div className="text-muted">Parcelas</div><div className="num mt-0.5 text-[15px] font-semibold">{brl(s.debts.monthlyPayments)}</div></div>
        </div>
        {benefit > 0 && <p className="mt-3 text-[12px] text-faint">Sem contar {brl(benefit)} do vale alimentação, que só pode ser usado com comida. Já descontada a reserva planejada do mês.</p>}
      </Panel>

      {alert && (
        <Panel onClick={() => navigate(alert.href ?? "/analise")} className="flex items-start gap-3 p-4">
          <span className="mt-0.5">
            {alert.kind === "positivo" ? <CircleCheck size={20} className="text-pos" /> : alert.kind === "oportunidade" ? <Lightbulb size={20} className="text-info" />
              : alert.severity === "critico" ? <OctagonExclamationPoint size={20} className="text-neg" /> : <TriangleExclamationPoint size={20} className={alert.severity === "alto" ? "text-neg" : "text-warn"} />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold">{alert.title}</span>
            <span className="mt-0.5 block text-[13px] text-muted">{alert.detail}</span>
          </span>
          <ChevronRight size={18} className="mt-1 shrink-0 text-faint" />
        </Panel>
      )}

      <Section title="Próximas contas" action={bills.length ? { label: `Total ${brl(billsTotal)}`, href: "/cartoes" } : undefined}>
        <Panel className="divide-y divide-line overflow-hidden">
          {bills.length === 0 && <p className="p-4 text-[14px] text-muted">Nenhuma conta nos próximos dias.</p>}
          {bills.map((b) => {
            const chip = b.date ? dayChip(b.date) : null;
            return (
              <Row key={b.id}
                left={<span className={cx("flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl bg-surface-2 leading-none", b.overdue && "bg-neg/15 text-neg")}>
                  {chip ? <><span className="num text-[16px] font-semibold">{chip.day}</span><span className="mt-0.5 text-[10px] uppercase text-muted">{chip.dow}</span></> : <span className="text-[11px] font-semibold uppercase text-muted">{monthLabel(b.monthKey).split("/")[0]}</span>}
                </span>}
                title={b.label}
                subtitle={b.date ? `${b.overdue ? "Vencida em" : "Vence"} ${dateBR(b.date)} · ${b.detail}` : `Sem dia definido · ${b.detail}`}
                right={<Amount value={b.amount} className="text-[15px] font-semibold" />} />
            );
          })}
        </Panel>
      </Section>

      {goals.length > 0 && (
        <Section title="Metas" action={{ label: "Ver todas", href: "/plano?aba=metas" }}>
          <div className="grid gap-3 sm:grid-cols-2">
            {goals.map((g) => (
              <Panel key={g.goal.id} onClick={() => navigate("/plano?aba=metas")} className="p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-[15px] font-semibold">{g.goal.name}</span>
                  <span className="num text-[13px] text-muted">{Math.round(g.progress * 100)}%</span>
                </div>
                <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(2, g.progress * 100)}%` }} /></div>
                <div className="mt-2 flex justify-between text-[12px] text-muted">
                  <span className="num">{brl(g.current)} de {brl(g.target)}</span>
                  <span>{g.planned ? `${brl(g.planned)}/mês` : "sem aporte"}</span>
                </div>
              </Panel>
            ))}
          </div>
        </Section>
      )}

      <Section title="Últimos lançamentos" action={{ label: "Ver todos", href: "/lancamentos" }}>
        <Panel className="divide-y divide-line overflow-hidden">
          {recent.length === 0 && <p className="p-4 text-[14px] text-muted">Nada lançado ainda. Use o botão + para registrar.</p>}
          {recent.map((t) => {
            const c = t.category_id ? catById.get(t.category_id) : null;
            return <Row key={t.id} left={<CatIcon cat={c} kind={t.kind} />} title={t.description} subtitle={`${c?.name ?? (t.kind === "income" ? "Receita" : "Sem categoria")} · ${dateBR(t.occurred_on)}`}
              right={<Amount value={t.kind === "expense" ? -num(t.amount) : num(t.amount)} signed={t.kind === "income"} className="text-[15px] font-semibold" />} />;
          })}
        </Panel>
      </Section>

      <div className="grid grid-cols-2 gap-3">
        <Panel onClick={() => navigate("/consultor")} className="p-4">
          <Sparkles size={20} className="text-accent" />
          <span className="mt-2 block text-[15px] font-semibold">Perguntar ao consultor</span>
          <span className="block text-[12px] text-muted">"Posso comprar…?"</span>
        </Panel>
        <Panel onClick={() => navigate("/analise")} className="p-4">
          <span className="num block text-[22px] font-semibold" style={{ color: a.health.score === null ? undefined : a.health.score >= 65 ? "var(--pos)" : a.health.score >= 45 ? "var(--warn)" : "var(--neg)" }}>{a.health.score ?? "—"}</span>
          <span className="mt-1 block text-[15px] font-semibold">Saúde financeira</span>
          <span className="block text-[12px] text-muted">Ver análise completa</span>
        </Panel>
      </div>
    </div>
  );
}
