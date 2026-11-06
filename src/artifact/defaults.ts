// Categorias iniciais (as mesmas da migração SQL), com ids fixos no formato UUID.
import type { Category } from "@/lib/finance/types";

const RAW: [string, string, Category["bucket"], boolean][] = [
  ["Moradia", "Aluguel", "essenciais", true], ["Moradia", "Condomínio", "essenciais", true],
  ["Moradia", "Energia", "essenciais", true], ["Moradia", "Água", "essenciais", true],
  ["Moradia", "Internet", "essenciais", true], ["Moradia", "Manutenção", "essenciais", true],
  ["Alimentação", "Supermercado", "essenciais", true], ["Alimentação", "Restaurantes", "lazer", false],
  ["Alimentação", "Delivery", "lazer", false], ["Alimentação", "Lanches", "lazer", false],
  ["Transporte", "Combustível", "essenciais", true], ["Transporte", "Manutenção do veículo", "essenciais", true],
  ["Transporte", "Seguro", "essenciais", true], ["Transporte", "Transporte por aplicativo", "pessoais", false],
  ["Pessoal", "Roupas", "pessoais", false], ["Pessoal", "Academia", "pessoais", false],
  ["Pessoal", "Beleza", "pessoais", false], ["Pessoal", "Higiene", "essenciais", true],
  ["Pessoal", "Saúde", "essenciais", true], ["Lazer", "Viagens", "lazer", false],
  ["Lazer", "Passeios", "lazer", false], ["Lazer", "Jogos", "lazer", false],
  ["Lazer", "Streaming", "lazer", false], ["Lazer", "Entretenimento", "lazer", false],
  ["Financeiro", "Investimentos", "financeiro", false], ["Financeiro", "Empréstimos", "financeiro", true],
  ["Financeiro", "Juros", "financeiro", true], ["Financeiro", "Tarifas", "financeiro", true],
  ["Financeiro", "Impostos", "financeiro", true],
];

export const DEFAULT_CATEGORIES: Category[] = RAW.map(([group_name, name, bucket, essential_default], i) => ({
  id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
  group_name, name, bucket, essential_default, is_custom: false,
}));
