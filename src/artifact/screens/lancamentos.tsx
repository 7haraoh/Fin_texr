import { useMemo, useState } from "react";
import { addMonthsKey, monthKey, monthLabelFull } from "@/lib/finance/dates";
import { brl, dateBR } from "@/lib/finance/format";
import { num, type Transaction } from "@/lib/finance/types";
import { EntityForm } from "@/components/forms";
import { transactionFields } from "@/components/transactions";
import { buttonClass, cx } from "@/components/ui";
import { deleteRecord } from "../actions-shim";
import { analysisNow } from "../data-shim";
import { useRoute } from "../router";
import { Amount, CatIcon, MonthSwitcher, Panel, Row, Sheet } from "./common";

const DOW_FULL = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export function Lancamentos() {
  const { data, today } = analysisNow();
  const route = useRoute();
  const [month, setMonth] = useState(route.params.mes ?? monthKey(today));
  const [filter, setFilter] = useState<"todos" | "expense" | "income">("todos");
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const catById = useMemo(() => new Map(data.categories.map((c) => [c.id, c])), [data.categories]);
  const cardById = useMemo(() => new Map(data.cards.map((c) => [c.id, c])), [data.cards]);

  const rows = data.transactions.filter((t) => monthKey(t.occurred_on) === month && (filter === "todos" || t.kind === filter));
  const out = rows.filter((t) => t.kind === "expense").reduce((s, t) => s + num(t.amount), 0);
  const inn = rows.filter((t) => t.kind === "income").reduce((s, t) => s + num(t.amount), 0);
  const groups = new Map<string, Transaction[]>();
  rows.forEach((t) => groups.set(t.occurred_on, [...(groups.get(t.occurred_on) ?? []), t]));

  return (
    <div className="space-y-5 pt-1">
      <h1 className="text-[28px] font-semibold tracking-tight">Lançamentos</h1>
      <MonthSwitcher label={monthLabelFull(month)} onPrev={() => setMonth(addMonthsKey(month, -1))} onNext={() => setMonth(addMonthsKey(month, 1))} />

      <div className="grid grid-cols-2 gap-3">
        <Panel className="p-4"><div className="text-[12px] text-muted">Saídas</div><div className="num mt-0.5 text-[20px] font-semibold">{brl(out)}</div></Panel>
        <Panel className="p-4"><div className="text-[12px] text-muted">Receitas extras</div><div className="num mt-0.5 text-[20px] font-semibold text-pos">{brl(inn)}</div></Panel>
      </div>

      <div className="flex gap-2">
        {([["todos", "Todos"], ["expense", "Despesas"], ["income", "Receitas"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)} className={cx("rounded-full px-3.5 py-1.5 text-[13px] font-medium transition", filter === k ? "bg-fg text-bg" : "bg-surface-2 text-muted")}>{l}</button>
        ))}
      </div>

      {rows.length === 0 && <Panel className="p-6 text-center text-[14px] text-muted">Nenhum lançamento neste mês. Toque em + para registrar.</Panel>}
      {[...groups.entries()].map(([date, list]) => {
        const [y, m, d] = date.split("-").map(Number);
        const dow = DOW_FULL[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
        const dayTotal = list.reduce((s, t) => s + (t.kind === "expense" ? -num(t.amount) : t.kind === "income" ? num(t.amount) : 0), 0);
        return (
          <section key={date} className="space-y-2">
            <div className="flex justify-between px-1 text-[13px] text-muted">
              <span><span className="font-semibold text-fg">{dow}</span>, {dateBR(date).slice(0, 5)}{date > today && " · agendado"}</span>
              <span className="num">{brl(dayTotal)}</span>
            </div>
            <Panel className="divide-y divide-line overflow-hidden">
              {list.map((t) => {
                const c = t.category_id ? catById.get(t.category_id) : null;
                const sub = [c?.name ?? (t.kind === "income" ? "Receita extra" : t.kind === "card_payment" ? "Pagamento de fatura" : "Sem categoria"),
                  t.payment_method === "credito" && t.card_id ? cardById.get(t.card_id)?.name : null,
                  t.installments > 1 ? `${t.installments}x` : null, t.recurrence === "mensal" ? "mensal" : null].filter(Boolean).join(" · ");
                return <Row key={t.id} onClick={() => { setEditing(t); setConfirmDel(false); }} left={<CatIcon cat={c} kind={t.kind} />} title={t.description} subtitle={sub}
                  right={<Amount value={t.kind === "expense" ? -num(t.amount) : num(t.amount)} signed={t.kind === "income"} className="text-[15px] font-semibold" />} />;
              })}
            </Panel>
          </section>
        );
      })}

      <Sheet open={editing !== null} onClose={() => setEditing(null)} title="Editar lançamento">
        {editing && (
          <div className="space-y-4">
            <EntityForm table="transactions" fields={transactionFields(data.categories, data.cards)} initial={editing as unknown as Record<string, unknown>} id={editing.id} onDone={() => setEditing(null)} />
            <div className="border-t border-line pt-4 text-center">
              {confirmDel ? (
                <div className="flex items-center justify-center gap-2 text-sm">
                  <span className="text-muted">Excluir este lançamento?</span>
                  <button onClick={async () => { await deleteRecord("transactions", editing.id); setEditing(null); }} className={buttonClass("danger", "sm")}>Excluir</button>
                  <button onClick={() => setConfirmDel(false)} className={buttonClass("ghost", "sm")}>Cancelar</button>
                </div>
              ) : <button onClick={() => setConfirmDel(true)} className="text-[14px] font-medium text-neg">Excluir lançamento</button>}
            </div>
          </div>
        )}
      </Sheet>
    </div>
  );
}
