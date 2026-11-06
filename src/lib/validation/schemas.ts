import { z } from "zod";

const emptyToNull = (v: unknown) => (v === "" || v === undefined ? null : v);
const money = z.coerce.number().finite().min(0, "Valor não pode ser negativo").max(1e12);
const positiveMoney = z.coerce.number().finite().gt(0, "Informe um valor maior que zero").max(1e12);
const optMoney = z.preprocess(emptyToNull, z.coerce.number().finite().min(0).max(1e12).nullable());
const optNumber = z.preprocess(emptyToNull, z.coerce.number().finite().nullable());
const optDay = z.preprocess(emptyToNull, z.coerce.number().int().min(1).max(31).nullable());
const optInt = z.preprocess(emptyToNull, z.coerce.number().int().min(0).max(1000).nullable());
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida");
const optDate = z.preprocess(emptyToNull, isoDate.nullable());
const text = (max = 200) => z.string().trim().min(1, "Campo obrigatório").max(max);
const optText = (max = 1000) => z.preprocess(emptyToNull, z.string().trim().max(max).nullable());
const bool = z.preprocess((v) => v === true || v === "true" || v === "on" || v === 1, z.boolean());
const optUuid = z.preprocess(emptyToNull, z.string().uuid().nullable());

export const schemas = {
  income_sources: z.object({
    name: text(),
    type: z.enum(["salario", "beneficio", "freelance", "aluguel", "investimento", "outro"]),
    gross_amount: optMoney,
    net_amount: money,
    frequency: z.enum(["mensal", "quinzenal", "semanal", "anual", "eventual"]),
    stability: z.enum(["estavel", "variavel", "incerta"]),
    pay_day: optDay,
    expected_change_pct: optNumber,
    expected_change_date: optDate,
    notes: optText(),
    active: bool,
  }),
  assets: z.object({
    name: text(),
    type: z.enum(["conta", "especie", "poupanca", "investimento", "imovel", "veiculo", "outro"]),
    value: money,
    institution: optText(120),
    is_emergency_reserve: bool,
    notes: optText(),
  }),
  debts: z.object({
    name: text(),
    type: z.enum(["emprestimo", "financiamento", "parcelamento", "cheque_especial", "outro"]),
    outstanding_balance: money,
    monthly_payment: money,
    interest_rate_monthly: optNumber,
    remaining_installments: optInt,
    due_day: optDay,
    is_late: bool,
    notes: optText(),
  }),
  credit_cards: z.object({
    name: text(),
    credit_limit: money,
    closing_day: z.coerce.number().int().min(1).max(31),
    due_day: z.coerce.number().int().min(1).max(31),
    carried_balance: money.default(0),
  }),
  transactions: z.object({
    kind: z.enum(["expense", "income", "card_payment"]),
    description: text(),
    amount: positiveMoney,
    category_id: optUuid,
    occurred_on: isoDate,
    payment_method: z.enum(["pix", "debito", "credito", "dinheiro", "boleto", "transferencia"]),
    card_id: optUuid,
    installments: z.coerce.number().int().min(1).max(72).default(1),
    is_essential: bool,
    recurrence: z.enum(["nenhuma", "semanal", "mensal", "anual"]),
    notes: optText(),
  }).superRefine((v, ctx) => {
    if (v.kind === "expense" && v.payment_method === "credito" && !v.card_id) {
      ctx.addIssue({ code: "custom", path: ["card_id"], message: "Selecione o cartão utilizado" });
    }
    if (v.kind === "card_payment" && !v.card_id) {
      ctx.addIssue({ code: "custom", path: ["card_id"], message: "Selecione o cartão da fatura" });
    }
  }).transform((v) => ({
    ...v,
    // Parcelamento só se aplica a compras no crédito
    installments: v.kind === "expense" && v.payment_method === "credito" ? v.installments : 1,
    card_id: v.payment_method === "credito" || v.kind === "card_payment" ? v.card_id : null,
    category_id: v.kind === "card_payment" ? null : v.category_id,
  })),
  goals: z.object({
    name: text(),
    type: z.enum(["reserva", "veiculo", "imovel", "viagem", "equipamento", "quitar_divida", "investimento", "independencia", "outro"]),
    target_amount: positiveMoney,
    current_amount: money,
    deadline: optDate,
    priority: z.coerce.number().int().min(1).max(3),
    monthly_contribution: money,
    horizon: z.enum(["curto", "longo"]),
    status: z.enum(["ativa", "pausada", "concluida"]),
  }),
  categories: z.object({
    name: text(80),
    group_name: text(80),
    bucket: z.enum(["essenciais", "pessoais", "lazer", "financeiro"]),
    essential_default: bool,
  }).transform((v) => ({ ...v, is_custom: true })),
  category_limits: z.object({
    category_id: z.string().uuid(),
    monthly_limit: money,
  }),
} as const;

export type EditableTable = keyof typeof schemas;
export const EDITABLE_TABLES = Object.keys(schemas) as EditableTable[];

const allocationKeys = ["essenciais", "pessoais", "lazer", "reserva", "investimentos", "metas_curto", "metas_longo"] as const;
export const allocationsSchema = z.object(
  Object.fromEntries(allocationKeys.map((k) => [k, z.coerce.number().finite().min(0).max(1e12)])) as Record<(typeof allocationKeys)[number], z.ZodCoercedNumber>,
);

export const profileSchema = z.object({
  full_name: optText(120),
  risk_profile: z.preprocess(emptyToNull, z.enum(["conservador", "moderado", "arrojado"]).nullable()),
  lifestyle: z.object({
    habits: optText(), hobbies: optText(), food_habits: optText(), leisure: optText(),
    personal_goals: optText(), desired_lifestyle: optText(), family_plans: optText(), future_projects: optText(),
    travel_frequency: z.preprocess(emptyToNull, z.enum(["nunca", "raramente", "anual", "semestral", "frequente"]).nullable()),
    save_vs_enjoy: z.preprocess(emptyToNull, z.coerce.number().int().min(1).max(5).nullable()),
    dependents: optInt,
  }),
});
