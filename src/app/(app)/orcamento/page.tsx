import { loadAnalysis } from "@/lib/data";
import { brl, monthsText } from "@/lib/finance/format";
import { monthLabelFull } from "@/lib/finance/dates";
import { Card, EmptyState, Notice, PageHeader, Progress, Stat } from "@/components/ui";
import { BudgetEditor, CategoryLimitsSection } from "@/components/budget-editor";

export const metadata = { title: "Orçamento" };

export default async function Orcamento() {
  const { data, analysis } = await loadAnalysis();
  const { snapshot: s, suggestion, budget, limits } = analysis;
  const income = s.income.monthlyNet;
  const spentById = Object.fromEntries(limits.map((l) => [l.categoryId, l.spent]));

  return (
    <>
      <PageHeader title="Planejamento orçamentário" subtitle={`${monthLabelFull(s.monthKey)} · distribuição personalizada da renda — não uma regra genérica como 50/30/20`} />
      {income <= 0 ? (
        <EmptyState title="Cadastre sua renda para planejar o orçamento" href="/perfil" cta="Ir ao perfil financeiro" />
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Renda líquida" value={brl(income)} />
            <Stat label="Gasto até agora" value={brl(s.month.expenses + s.debts.monthlyPayments)} hint="Despesas + parcelas de dívidas" />
            <Stat label="Recorrentes a lançar" value={brl(s.pendingRecurringThisMonth)} hint="Contas mensais ainda não registradas" />
            <Stat label="Livre para gastar" value={brl(Math.max(0, s.freeToSpend.monthRemaining))} estimate tone={s.freeToSpend.monthRemaining < 0 ? "neg" : undefined}
              hint={`${brl(s.freeToSpend.perDay)}/dia · ${monthsText(s.freeToSpend.remainingDays / 30)} restantes`} />
          </div>

          {suggestion.deficit > 0 && <div className="mb-6"><Notice tone="neg">Suas despesas essenciais e parcelas superam a renda em <strong>{brl(suggestion.deficit)}</strong>. Antes de qualquer meta, é preciso reduzir custos fixos ou renegociar dívidas — converse com o consultor para montar um plano.</Notice></div>}

          <div className="grid gap-6 lg:grid-cols-2">
            <Card title={budget ? "Seu plano do mês" : "Sugestão para este mês"} subtitle="Ajuste os valores e salve. O sistema recalcula a sugestão sempre que renda ou despesas mudam.">
              <BudgetEditor income={income} suggested={suggestion.allocations} saved={data.budgetPlan?.allocations ?? null} />
            </Card>
            <div className="space-y-6">
              <Card title="Por que esta distribuição">
                <ul className="list-disc space-y-1.5 pl-4 text-sm text-muted">{suggestion.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>
              </Card>
              <Card title="Consumido × disponível" subtitle={budget ? "Com base no plano salvo" : "Salve um plano para acompanhar"}>
                {!budget ? <p className="text-sm text-muted">Nenhum plano salvo para este mês ainda.</p> : (
                  <ul className="space-y-3">
                    {budget.filter((b) => b.key === "essenciais" || b.key === "pessoais" || b.key === "lazer" || b.key === "investimentos").map((b) => (
                      <li key={b.key}>
                        <div className="mb-1 flex justify-between text-sm"><span>{b.label}</span><span className="num text-xs text-muted">{brl(b.spent)} de {brl(b.planned)}</span></div>
                        <Progress value={b.progress} tone={b.key === "investimentos" ? "pos" : "auto"} />
                        <div className="mt-0.5 text-[11px] text-faint">{b.remaining >= 0 ? `${brl(b.remaining)} disponíveis` : `${brl(-b.remaining)} acima do planejado`}</div>
                      </li>
                    ))}
                    <li className="text-[11px] text-faint">Reserva e metas são acompanhadas em suas próprias telas.</li>
                  </ul>
                )}
              </Card>
            </div>
          </div>

          <Card className="mt-6" title="Limites por categoria">
            <CategoryLimitsSection rows={data.categoryLimits} categories={data.categories} spentById={spentById} />
          </Card>
        </>
      )}
    </>
  );
}
