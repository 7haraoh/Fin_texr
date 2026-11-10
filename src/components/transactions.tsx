"use client";

import { useMemo } from "react";
import { CrudSection, type FieldDef } from "./forms";
import { Badge, Money } from "./ui";
import { BUCKET, KIND, PAYMENT, RECURRENCE, opts } from "@/lib/labels";
import { dateBR } from "@/lib/finance/format";
import type { Category, CreditCard, Transaction } from "@/lib/finance/types";

/** Campos do formulário de lançamento (reaproveitados no app publicado). */
export function transactionFields(categories: Category[], cards: CreditCard[]): FieldDef[] {
  const catById = new Map(categories.map((c) => [c.id, c]));
  return [
    { name: "kind", label: "Tipo de lançamento", type: "select", required: true, options: opts(KIND), full: true,
      help: "Pagamento de fatura apenas baixa a dívida do cartão — não é contado como gasto." },
    { name: "description", label: "Descrição", type: "text", required: true, placeholder: "Ex.: Supermercado" },
    { name: "amount", label: "Valor total", type: "money", required: true },
    { name: "occurred_on", label: "Data", type: "date", required: true },
    { name: "category_id", label: "Categoria", type: "select", showIf: (v) => v.kind !== "card_payment",
      options: categories.map((c) => ({ value: c.id, label: `${c.group_name} › ${c.name}` })),
      effect: (value) => { const c = catById.get(String(value)); return c ? { is_essential: c.essential_default } : {}; } },
    { name: "payment_method", label: "Forma de pagamento", type: "select", required: true, options: opts(PAYMENT), showIf: (v) => v.kind !== "card_payment" },
    { name: "card_id", label: "Cartão", type: "select", options: cards.map((c) => ({ value: c.id, label: c.name })),
      showIf: (v) => v.payment_method === "credito" || v.kind === "card_payment",
      help: cards.length ? undefined : "Cadastre um cartão no Perfil financeiro" },
    { name: "installments", label: "Parcelas", type: "int", showIf: (v) => v.kind === "expense" && v.payment_method === "credito",
      help: "A compra inteira conta como gasto na data; as parcelas entram nas faturas futuras." },
    { name: "recurrence", label: "Recorrência", type: "select", required: true, options: opts(RECURRENCE), showIf: (v) => v.kind === "expense" },
    { name: "is_essential", label: "Despesa essencial", type: "checkbox", showIf: (v) => v.kind === "expense", help: "Necessária para manter seu padrão básico de vida" },
    { name: "notes", label: "Observações", type: "textarea", full: true },
  ];
}

export function TransactionsSection({ rows, categories, cards, today }: {
  rows: Transaction[]; categories: Category[]; cards: CreditCard[]; today: string;
}) {
  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const cardById = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);

  const fields: FieldDef[] = useMemo(() => transactionFields(categories, cards), [categories, cards]);

  return (
    <CrudSection table="transactions" rows={rows} fields={fields} addLabel="Novo lançamento"
      defaults={{ kind: "expense", occurred_on: today, payment_method: "pix", recurrence: "nenhuma", installments: 1 }}
      emptyTitle="Nenhum lançamento neste período" emptyText="Registre despesas para o sistema identificar padrões, excessos e oportunidades."
      columns={[
        { label: "Data", render: (r) => <span className="num text-muted">{dateBR(r.occurred_on)}</span> },
        { label: "Descrição", render: (r) => {
          const c = r.category_id ? catById.get(r.category_id) : null;
          return (
            <div>
              <div className="font-medium">{r.description}</div>
              <div className="text-xs text-faint">
                {r.kind === "expense" ? (c ? `${c.group_name} › ${c.name}` : "Sem categoria") : KIND[r.kind]}
                {r.payment_method === "credito" && r.card_id && ` · ${cardById.get(r.card_id)?.name ?? "cartão"}`}
                {r.installments > 1 && ` · ${r.installments}x`}
              </div>
            </div>
          );
        } },
        { label: "Classificação", hideOnMobile: true, render: (r) => r.kind !== "expense" ? null : (
          <span className="flex flex-wrap gap-1">
            <Badge tone={r.is_essential ? "info" : "neutral"}>{r.is_essential ? "Essencial" : "Não essencial"}</Badge>
            {r.recurrence !== "nenhuma" && <Badge>{RECURRENCE[r.recurrence]}</Badge>}
          </span>
        ) },
        { label: "Pagamento", hideOnMobile: true, render: (r) => <span className="text-xs text-muted">{PAYMENT[r.payment_method]}</span> },
        { label: "Valor", align: "right", render: (r) => <Money value={r.kind === "expense" ? -Number(r.amount) : Number(r.amount)} signed={r.kind !== "card_payment"} /> },
      ]} />
  );
}

export function CategoriesSection({ rows }: { rows: Category[] }) {
  const fields: FieldDef[] = [
    { name: "group_name", label: "Grupo", type: "text", required: true, placeholder: "Ex.: Pets" },
    { name: "name", label: "Nome da categoria", type: "text", required: true, placeholder: "Ex.: Ração" },
    { name: "bucket", label: "Finalidade no orçamento", type: "select", required: true, options: opts(BUCKET) },
    { name: "essential_default", label: "Essencial por padrão", type: "checkbox" },
  ];
  return (
    <CrudSection table="categories" rows={rows} fields={fields} addLabel="Nova categoria"
      defaults={{ bucket: "pessoais" }} canDelete={(r) => r.is_custom}
      emptyTitle="Sem categorias"
      columns={[
        { label: "Categoria", render: (r) => <div><div className="font-medium">{r.name}</div><div className="text-xs text-faint">{r.group_name}</div></div> },
        { label: "Finalidade", render: (r) => <Badge>{BUCKET[r.bucket]}</Badge> },
        { label: "", hideOnMobile: true, render: (r) => r.is_custom ? <Badge tone="info">Personalizada</Badge> : <span className="text-xs text-faint">Padrão</span> },
      ]} />
  );
}
