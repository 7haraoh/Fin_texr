import Link from "next/link";
import { loadAnalysis } from "@/lib/data";
import { brl, dateBR, pct } from "@/lib/finance/format";
import { monthLabel } from "@/lib/finance/dates";
import { Badge, Card, EmptyState, PageHeader, Progress, Stat, buttonClass } from "@/components/ui";
import { GroupedBars } from "@/components/charts";
import { CardSection, DebtSection } from "@/components/entities";

export const metadata = { title: "Cartões e dívidas" };

export default async function Cartoes() {
  const { data, analysis } = await loadAnalysis();
  const s = analysis.snapshot;
  const future = s.futureCommitments.map((f) => ({ label: f.label, dividas: f.debts, faturas: f.cards }));
  const peak = s.futureCommitments.reduce((m, f) => Math.max(m, f.shareOfIncome), 0);
  return (
    <>
      <PageHeader title="Cartões e dívidas" subtitle="Compras no cartão são consumo na data da compra; aqui você acompanha as obrigações de caixa (faturas e parcelas)."
        actions={<Link href="/despesas" className={buttonClass("outline", "sm")}>Registrar pagamento de fatura</Link>} />
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Dívida total" value={brl(s.debts.totalOutstanding)} hint={`Cartões ${brl(s.debts.cardUsed)} · empréstimos ${brl(s.debts.loansOutstanding)}`} />
        <Stat label="Parcelas mensais" value={brl(s.debts.monthlyPayments)} hint={`${pct(s.debtRatio)} da renda`} tone={s.debtRatio > 0.3 ? "neg" : undefined} />
        <Stat label="Próximas faturas" value={brl(s.debts.cardNextBills)} tone={s.debts.cardOverdue > 0 ? "neg" : undefined} hint={s.debts.cardOverdue > 0 ? `${brl(s.debts.cardOverdue)} em atraso` : "Somando todos os cartões"} />
        <Stat label="Pico de comprometimento" value={pct(peak)} hint="Maior mês nos próximos 12" tone={peak > 0.4 ? "neg" : peak > 0.3 ? "warn" : undefined} />
      </div>

      <Card title="Comprometimento futuro da renda" subtitle="Faturas já contratadas (incluindo parcelas) e parcelas de dívidas por mês de vencimento">
        <GroupedBars data={future} series={[{ key: "faturas", name: "Faturas de cartão" }, { key: "dividas", name: "Empréstimos e financiamentos" }]} />
      </Card>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {s.cards.length === 0 && <div className="lg:col-span-2"><EmptyState title="Nenhum cartão cadastrado" text="Cadastre abaixo para acompanhar faturas e limites." /></div>}
        {s.cards.map((c) => (
          <Card key={c.card.id} title={c.card.name} subtitle={`Fecha dia ${c.card.closing_day} · vence dia ${c.card.due_day}`}
            action={c.overdueAmount > 0 ? <Badge tone="neg">Em atraso</Badge> : c.utilization >= 0.7 ? <Badge tone="warn">Limite alto</Badge> : <Badge tone="pos">Em dia</Badge>}>
            <div className="mb-1 flex justify-between text-xs"><span className="text-muted">Limite usado (com parcelas futuras)</span><span className="num">{brl(c.used)} de {brl(c.limit)}</span></div>
            <Progress value={c.utilization} tone={c.utilization >= 0.9 ? "neg" : c.utilization >= 0.7 ? "warn" : "pos"} />
            <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
              <div><div className="text-faint">Fatura aberta</div><div className="num font-medium">{brl(c.openStatement?.remaining ?? 0)}</div></div>
              <div><div className="text-faint">Próximo pagamento</div><div className="num font-medium">{c.nextBill ? `${brl(c.nextBill.remaining)}` : "—"}</div>{c.nextBill && <div className="text-faint">{dateBR(c.nextBill.dueDate)}</div>}</div>
              <div><div className="text-faint">Parcelas futuras</div><div className="num font-medium">{brl(c.futureInstallments)}</div></div>
            </div>
            {c.statements.filter((st) => st.remaining > 0).length > 0 && (
              <table className="mt-4 w-full text-xs">
                <thead><tr className="text-left text-faint"><th className="py-1 font-medium">Fatura</th><th className="py-1 font-medium">Vencimento</th><th className="py-1 text-right font-medium">A pagar</th></tr></thead>
                <tbody>
                  {c.statements.filter((st) => st.remaining > 0).slice(0, 8).map((st) => (
                    <tr key={st.closeKey} className="border-t border-line/60">
                      <td className="py-1.5">{monthLabel(st.closeKey)} {st.state === "aberta" && <Badge tone="info">aberta</Badge>}{st.overdue && <Badge tone="neg">vencida</Badge>}</td>
                      <td className="py-1.5 text-muted">{dateBR(st.dueDate)}</td>
                      <td className="num py-1.5 text-right">{brl(st.remaining)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Cartões"><CardSection rows={data.cards} /></Card>
        <Card title="Empréstimos e financiamentos"><DebtSection rows={data.debts} /></Card>
      </div>
    </>
  );
}
