import { Category, CreditCard, FinancialData, Transaction } from "./types";

let seq = 0;
export const id = () => `id-${++seq}`;

export const cats: Category[] = [
  { id: "c-aluguel", name: "Aluguel", group_name: "Moradia", bucket: "essenciais", essential_default: true, is_custom: false },
  { id: "c-mercado", name: "Supermercado", group_name: "Alimentação", bucket: "essenciais", essential_default: true, is_custom: false },
  { id: "c-delivery", name: "Delivery", group_name: "Alimentação", bucket: "lazer", essential_default: false, is_custom: false },
  { id: "c-roupas", name: "Roupas", group_name: "Pessoal", bucket: "pessoais", essential_default: false, is_custom: false },
  { id: "c-invest", name: "Investimentos", group_name: "Financeiro", bucket: "financeiro", essential_default: false, is_custom: false },
];

export function tx(p: Partial<Transaction> & Pick<Transaction, "amount" | "occurred_on">): Transaction {
  return {
    id: id(), kind: "expense", description: "x", category_id: null, payment_method: "pix", card_id: null,
    installments: 1, is_essential: false, recurrence: "nenhuma", notes: null, ...p,
  };
}

export const card: CreditCard = { id: "card-1", name: "Cartão A", credit_limit: 5000, closing_day: 10, due_day: 20, carried_balance: 0 };

export function baseData(over: Partial<FinancialData> = {}): FinancialData {
  return {
    profile: null,
    incomes: [{
      id: "i1", name: "Salário", type: "salario", gross_amount: 8000, net_amount: 6000, frequency: "mensal",
      stability: "estavel", pay_day: 5, expected_change_pct: null, expected_change_date: null, notes: null, active: true,
    }],
    assets: [
      { id: "a1", name: "Conta", type: "conta", value: 4000, institution: null, is_emergency_reserve: false, notes: null },
      { id: "a2", name: "Reserva", type: "poupanca", value: 12000, institution: null, is_emergency_reserve: true, notes: null },
      { id: "a3", name: "Carro", type: "veiculo", value: 40000, institution: null, is_emergency_reserve: false, notes: null },
    ],
    debts: [],
    cards: [card],
    categories: cats,
    transactions: [],
    goals: [],
    budgetPlan: null,
    categoryLimits: [],
    snapshots: [],
    ...over,
  };
}
