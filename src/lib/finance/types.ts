// Tipos de linha do banco (snake_case, como retornados pelo Supabase).
// Valores numeric chegam como number ou string — normalizamos com num().

export type Num = number | string | null | undefined;

export interface Profile {
  id: string;
  full_name: string | null;
  risk_profile: "conservador" | "moderado" | "arrojado" | null;
  lifestyle: Lifestyle;
}

export interface Lifestyle {
  habits?: string;
  hobbies?: string;
  travel_frequency?: "nunca" | "raramente" | "anual" | "semestral" | "frequente";
  food_habits?: string;
  leisure?: string;
  personal_goals?: string;
  desired_lifestyle?: string;
  family_plans?: string;
  future_projects?: string;
  /** 1 = priorizo economizar … 5 = priorizo aproveitar o presente */
  save_vs_enjoy?: number;
  dependents?: number;
  /** Tem plano de saúde (reduz o custo do cenário de despesa médica) */
  health_plan?: boolean;
  health_plan_name?: string;
}

export type IncomeFrequency = "mensal" | "quinzenal" | "semanal" | "anual" | "eventual";

export interface IncomeSource {
  id: string;
  name: string;
  type: "salario" | "beneficio" | "freelance" | "aluguel" | "investimento" | "outro";
  gross_amount: Num;
  net_amount: Num;
  frequency: IncomeFrequency;
  stability: "estavel" | "variavel" | "incerta";
  pay_day: number | null;
  expected_change_pct: Num;
  expected_change_date: string | null;
  /** Primeiro mês em que o valor integral é recebido (ex.: emprego novo). Antes disso, só lançamentos de receita contam. */
  starts_on?: string | null;
  notes: string | null;
  active: boolean;
}

export type AssetType = "conta" | "especie" | "poupanca" | "investimento" | "imovel" | "veiculo" | "outro";

export interface Asset {
  id: string;
  name: string;
  type: AssetType;
  value: Num;
  institution: string | null;
  is_emergency_reserve: boolean;
  notes: string | null;
}

export interface Debt {
  id: string;
  name: string;
  type: "emprestimo" | "financiamento" | "parcelamento" | "cheque_especial" | "outro";
  outstanding_balance: Num;
  monthly_payment: Num;
  interest_rate_monthly: Num;
  remaining_installments: number | null;
  due_day: number | null;
  is_late: boolean;
  notes: string | null;
}

export interface CreditCard {
  id: string;
  name: string;
  credit_limit: Num;
  closing_day: number;
  due_day: number;
  carried_balance: Num;
}

export type Bucket = "essenciais" | "pessoais" | "lazer" | "financeiro";

export interface Category {
  id: string;
  name: string;
  group_name: string;
  bucket: Bucket;
  essential_default: boolean;
  is_custom: boolean;
}

export type TransactionKind = "expense" | "income" | "card_payment";
export type PaymentMethod = "pix" | "debito" | "credito" | "dinheiro" | "boleto" | "transferencia";
export type Recurrence = "nenhuma" | "semanal" | "mensal" | "anual";

export interface Transaction {
  id: string;
  kind: TransactionKind;
  description: string;
  amount: Num;
  category_id: string | null;
  occurred_on: string; // YYYY-MM-DD
  payment_method: PaymentMethod;
  card_id: string | null;
  installments: number;
  is_essential: boolean;
  recurrence: Recurrence;
  notes: string | null;
}

export type GoalType =
  | "reserva" | "veiculo" | "imovel" | "viagem" | "equipamento"
  | "quitar_divida" | "investimento" | "independencia" | "outro";

export interface Goal {
  id: string;
  name: string;
  type: GoalType;
  target_amount: Num;
  current_amount: Num;
  deadline: string | null;
  priority: number;
  monthly_contribution: Num;
  horizon: "curto" | "longo";
  status: "ativa" | "pausada" | "concluida";
}

export type AllocationKey =
  | "essenciais" | "pessoais" | "lazer" | "reserva" | "investimentos" | "metas_curto" | "metas_longo";

export type Allocations = Partial<Record<AllocationKey, number>>;

export interface BudgetPlan {
  id: string;
  month: string;
  allocations: Allocations;
}

export interface CategoryLimit {
  id: string;
  category_id: string;
  monthly_limit: Num;
}

export interface MonthlySnapshotRow {
  month: string;
  net_worth: Num;
  liquid_assets: Num;
  emergency_reserve: Num;
  total_debt: Num;
}

/** Tudo que o motor precisa para analisar um usuário. */
export interface FinancialData {
  profile: Profile | null;
  incomes: IncomeSource[];
  assets: Asset[];
  debts: Debt[];
  cards: CreditCard[];
  categories: Category[];
  transactions: Transaction[];
  goals: Goal[];
  budgetPlan: BudgetPlan | null;
  categoryLimits: CategoryLimit[];
  snapshots: MonthlySnapshotRow[];
}

export function num(v: Num): number {
  if (v === null || v === undefined || v === "") return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Arredonda para centavos evitando erros de ponto flutuante. */
export function round2(v: number): number {
  return Math.round((v + Number.EPSILON) * 100) / 100;
}
