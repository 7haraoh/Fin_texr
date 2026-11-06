import Link from "next/link";
import { loadAnalysis } from "@/lib/data";
import { addMonthsKey, monthKey, monthLabelFull } from "@/lib/finance/dates";
import { brl, pct } from "@/lib/finance/format";
import { num } from "@/lib/finance/types";
import { isInvestmentCategory } from "@/lib/finance/snapshot";
import { Badge, Card, PageHeader, Stat, buttonClass, cx } from "@/components/ui";
import { CategoriesSection, TransactionsSection } from "@/components/transactions";

export const metadata = { title: "Despesas" };

export default async function Despesas({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { data, analysis, today } = await loadAnalysis();
  const cur = monthKey(today);
  const month = sp.mes && /^\d{4}-\d{2}$/.test(sp.mes) ? sp.mes : cur;
  const kind = sp.tipo ?? "todos";
  const catById = new Map(data.categories.map((c) => [c.id, c]));

  const monthRows = data.transactions.filter((t) => monthKey(t.occurred_on) === month);
  const rows = monthRows.filter((t) => kind === "todos" || t.kind === kind);
  const expenses = monthRows.filter((t) => t.kind === "expense" && !(t.category_id && catById.get(t.category_id) && isInvestmentCategory(catById.get(t.category_id)!)));
  const total = expenses.reduce((s, t) => s + num(t.amount), 0);
  const essential = expenses.filter((t) => t.is_essential).reduce((s, t) => s + num(t.amount), 0);
  const credit = expenses.filter((t) => t.payment_method === "credito").reduce((s, t) => s + num(t.amount), 0);
  const extra = monthRows.filter((t) => t.kind === "income").reduce((s, t) => s + num(t.amount), 0);
  const s = analysis.snapshot;

  const link = (params: Record<string, string>) => `/despesas?${new URLSearchParams({ mes: month, tipo: kind, ...params })}`;

  return (
    <>
      <PageHeader title="Controle de despesas" subtitle="Compras no cartão contam na data da compra; pagamentos de fatura não geram uma segunda despesa." />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link href={link({ mes: addMonthsKey(month, -1) })} className={buttonClass("outline", "sm")}>←</Link>
        <span className="min-w-36 text-center text-sm font-medium capitalize">{monthLabelFull(month)}</span>
        <Link href={link({ mes: addMonthsKey(month, 1) })} className={buttonClass("outline", "sm")}>→</Link>
        {month !== cur && <Link href={link({ mes: cur })} className={buttonClass("ghost", "sm")}>Mês atual</Link>}
        <div className="ml-auto flex gap-1">
          {[["todos", "Todos"], ["expense", "Despesas"], ["income", "Receitas extras"], ["card_payment", "Faturas pagas"]].map(([k, l]) => (
            <Link key={k} href={link({ tipo: k })} className={cx(buttonClass(kind === k ? "primary" : "ghost", "sm"))}>{l}</Link>
          ))}
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Total de despesas" value={brl(total)} hint={s.income.monthlyNet ? `${pct(total / s.income.monthlyNet)} da renda` : undefined} />
        <Stat label="Essenciais" value={brl(essential)} hint={`Não essenciais: ${brl(total - essential)}`} />
        <Stat label="No crédito" value={brl(credit)} hint="Já contabilizado como gasto" />
        <Stat label="Receitas extras" value={brl(extra)} />
      </div>

      <Card title="Lançamentos">
        <TransactionsSection rows={rows} categories={data.categories} cards={data.cards} today={today} />
      </Card>

      {month === cur && s.categories.length > 0 && (
        <Card className="mt-6" title="Padrões de consumo por categoria" subtitle={s.dataQuality.completeMonths ? `Mês atual comparado à média de ${s.dataQuality.completeMonths} mês(es) completo(s)` : "A comparação com a média aparece após o primeiro mês completo"}>
          <div className="-mx-5 overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead><tr className="border-b border-line text-left text-xs text-faint">
                <th className="px-5 py-2 font-medium">Categoria</th><th className="px-5 py-2 text-right font-medium">Mês atual</th>
                <th className="px-5 py-2 text-right font-medium">Média mensal</th><th className="px-5 py-2 text-right font-medium">% da renda</th><th className="px-5 py-2" />
              </tr></thead>
              <tbody>
                {s.categories.map((c) => (
                  <tr key={c.id} className="border-b border-line/60 last:border-0">
                    <td className="px-5 py-2"><div className="font-medium">{c.name}</div><div className="text-xs text-faint">{c.group}</div></td>
                    <td className="num px-5 py-2 text-right">{brl(c.thisMonth)}</td>
                    <td className="num px-5 py-2 text-right text-muted">{c.average ? brl(c.average) : "—"}</td>
                    <td className="num px-5 py-2 text-right text-muted">{pct(c.shareOfIncome)}</td>
                    <td className="px-5 py-2 text-right">{c.growth !== null && c.growth > 0.25 && c.average >= 100 ? <Badge tone="warn">acima da média</Badge> : c.trend !== null && c.trend > 0.3 && c.average >= 100 ? <Badge tone="info">em alta</Badge> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <details className="card mt-6 p-5">
        <summary className="cursor-pointer text-sm font-semibold">Categorias ({data.categories.length})</summary>
        <div className="mt-4"><CategoriesSection rows={data.categories} /></div>
      </details>
    </>
  );
}
