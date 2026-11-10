"use client";

import { CrudSection, type FieldDef } from "./forms";
import { Badge, Money } from "./ui";
import { ASSET_TYPE, DEBT_TYPE, FREQUENCY, INCOME_TYPE, STABILITY, opts } from "@/lib/labels";
import type { Asset, CreditCard, Debt, IncomeSource } from "@/lib/finance/types";
import { monthlyEquivalent } from "@/lib/finance/snapshot";

const incomeFields: FieldDef[] = [
  { name: "name", label: "Descrição", type: "text", required: true, placeholder: "Ex.: Salário empresa X" },
  { name: "type", label: "Tipo", type: "select", required: true, options: opts(INCOME_TYPE) },
  { name: "net_amount", label: "Valor líquido (recebido)", type: "money", required: true },
  { name: "gross_amount", label: "Valor bruto", type: "money", help: "Opcional" },
  { name: "frequency", label: "Frequência", type: "select", required: true, options: opts(FREQUENCY), help: "Eventuais não entram na renda recorrente" },
  { name: "stability", label: "Estabilidade", type: "select", required: true, options: opts(STABILITY) },
  { name: "pay_day", label: "Dia do recebimento", type: "day" },
  { name: "expected_change_pct", label: "Reajuste/mudança prevista", type: "percent", help: "Ex.: 5 para +5%, -20 para redução" },
  { name: "expected_change_date", label: "A partir de", type: "date" },
  { name: "starts_on", label: "Recebe o valor integral a partir de", type: "date", help: "Opcional. Para emprego ou benefício novo: antes desta data, só contam as receitas lançadas" },
  { name: "active", label: "Fonte de renda ativa", type: "checkbox" },
  { name: "notes", label: "Observações", type: "textarea", full: true },
];

export function IncomeSection({ rows }: { rows: IncomeSource[] }) {
  return (
    <CrudSection table="income_sources" rows={rows} fields={incomeFields} addLabel="Adicionar renda"
      defaults={{ type: "salario", frequency: "mensal", stability: "estavel", active: true }}
      emptyTitle="Nenhuma fonte de renda" emptyText="Comece pelo salário líquido — é a base de todas as análises."
      columns={[
        { label: "Fonte", render: (r) => <div><div className="font-medium">{r.name}</div><div className="text-xs text-faint">{INCOME_TYPE[r.type]} · {FREQUENCY[r.frequency]}{!r.active && " · inativa"}</div></div> },
        { label: "Estabilidade", render: (r) => <Badge tone={r.stability === "estavel" ? "pos" : r.stability === "variavel" ? "warn" : "neg"}>{STABILITY[r.stability]}</Badge>, hideOnMobile: true },
        { label: "Líquido", align: "right", render: (r) => <Money value={Number(r.net_amount)} /> },
        { label: "Mensal equiv.", align: "right", hideOnMobile: true, render: (r) => <Money value={monthlyEquivalent(Number(r.net_amount), r.frequency)} /> },
      ]} />
  );
}

const assetFields: FieldDef[] = [
  { name: "name", label: "Descrição", type: "text", required: true, placeholder: "Ex.: Conta corrente" },
  { name: "type", label: "Tipo", type: "select", required: true, options: opts(ASSET_TYPE) },
  { name: "value", label: "Saldo / valor atual", type: "money", required: true },
  { name: "institution", label: "Instituição", type: "text", help: "Opcional. Não informe senhas ou números de conta." },
  { name: "is_emergency_reserve", label: "Faz parte da reserva de emergência", type: "checkbox", full: true, help: "Dinheiro guardado exclusivamente para imprevistos, com liquidez" },
  { name: "notes", label: "Observações", type: "textarea", full: true },
];

export function AssetSection({ rows }: { rows: Asset[] }) {
  return (
    <CrudSection table="assets" rows={rows} fields={assetFields} addLabel="Adicionar ativo"
      defaults={{ type: "conta" }}
      emptyTitle="Nenhum ativo cadastrado" emptyText="Informe saldos em conta, poupança, investimentos e bens. São valores atuais (estoque), não renda."
      columns={[
        { label: "Ativo", render: (r) => <div><div className="font-medium">{r.name}</div><div className="text-xs text-faint">{ASSET_TYPE[r.type]}{r.institution ? ` · ${r.institution}` : ""}</div></div> },
        { label: "", render: (r) => r.is_emergency_reserve ? <Badge tone="pos">Reserva</Badge> : null, hideOnMobile: true },
        { label: "Valor", align: "right", render: (r) => <Money value={Number(r.value)} /> },
      ]} />
  );
}

const debtFields: FieldDef[] = [
  { name: "name", label: "Descrição", type: "text", required: true, placeholder: "Ex.: Financiamento do carro" },
  { name: "type", label: "Tipo", type: "select", required: true, options: opts(DEBT_TYPE) },
  { name: "outstanding_balance", label: "Saldo devedor atual", type: "money", required: true },
  { name: "monthly_payment", label: "Parcela mensal", type: "money", required: true },
  { name: "interest_rate_monthly", label: "Juros ao mês", type: "percent", help: "Consta no contrato (CET)" },
  { name: "remaining_installments", label: "Parcelas restantes", type: "int" },
  { name: "due_day", label: "Dia de vencimento", type: "day" },
  { name: "is_late", label: "Está em atraso", type: "checkbox" },
  { name: "notes", label: "Observações", type: "textarea", full: true },
];

export function DebtSection({ rows }: { rows: Debt[] }) {
  return (
    <CrudSection table="debts" rows={rows} fields={debtFields} addLabel="Adicionar obrigação"
      defaults={{ type: "emprestimo" }}
      emptyTitle="Nenhuma dívida cadastrada" emptyText="Empréstimos, financiamentos e parcelamentos fora do cartão. As parcelas entram automaticamente nos cálculos — não as lance como despesa."
      columns={[
        { label: "Obrigação", render: (r) => <div><div className="font-medium">{r.name}</div><div className="text-xs text-faint">{DEBT_TYPE[r.type]}{r.remaining_installments != null ? ` · ${r.remaining_installments} parcelas` : ""}</div></div> },
        { label: "Juros", hideOnMobile: true, render: (r) => r.interest_rate_monthly != null ? `${Number(r.interest_rate_monthly).toLocaleString("pt-BR")}% a.m.` : "—" },
        { label: "Parcela", align: "right", render: (r) => <span className="flex items-center justify-end gap-2">{r.is_late && <Badge tone="neg">atraso</Badge>}<Money value={Number(r.monthly_payment)} /></span> },
        { label: "Saldo", align: "right", hideOnMobile: true, render: (r) => <Money value={Number(r.outstanding_balance)} /> },
      ]} />
  );
}

const cardFields: FieldDef[] = [
  { name: "name", label: "Apelido do cartão", type: "text", required: true, placeholder: "Ex.: Visa principal", help: "Nunca informe o número do cartão" },
  { name: "credit_limit", label: "Limite total", type: "money", required: true },
  { name: "closing_day", label: "Dia de fechamento", type: "day", required: true },
  { name: "due_day", label: "Dia de vencimento", type: "day", required: true },
  { name: "carried_balance", label: "Saldo devedor anterior ao app", type: "money", full: true, help: "Valor já devido neste cartão (faturas/parcelas) antes de você começar a lançar compras aqui" },
];

export function CardSection({ rows }: { rows: CreditCard[] }) {
  return (
    <CrudSection table="credit_cards" rows={rows} fields={cardFields} addLabel="Adicionar cartão"
      emptyTitle="Nenhum cartão cadastrado" emptyText="Cadastre seus cartões para controlar faturas, limites e parcelas futuras."
      defaults={{ carried_balance: 0 }}
      columns={[
        { label: "Cartão", render: (r) => <div className="font-medium">{r.name}</div> },
        { label: "Fecha / vence", render: (r) => `dia ${r.closing_day} / dia ${r.due_day}` },
        { label: "Limite", align: "right", render: (r) => <Money value={Number(r.credit_limit)} /> },
      ]} />
  );
}
