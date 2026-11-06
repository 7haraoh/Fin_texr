export const opts = (m: Record<string, string>) => Object.entries(m).map(([value, label]) => ({ value, label }));

export const INCOME_TYPE: Record<string, string> = { salario: "Salário", beneficio: "Benefício", freelance: "Freelance / autônomo", aluguel: "Aluguel recebido", investimento: "Rendimentos", outro: "Outro" };
export const FREQUENCY: Record<string, string> = { mensal: "Mensal", quinzenal: "Quinzenal", semanal: "Semanal", anual: "Anual", eventual: "Eventual" };
export const STABILITY: Record<string, string> = { estavel: "Estável", variavel: "Variável", incerta: "Incerta" };
export const ASSET_TYPE: Record<string, string> = { conta: "Conta bancária", especie: "Dinheiro em espécie", poupanca: "Poupança", investimento: "Investimento", imovel: "Imóvel", veiculo: "Veículo", outro: "Outro bem" };
export const DEBT_TYPE: Record<string, string> = { emprestimo: "Empréstimo", financiamento: "Financiamento", parcelamento: "Parcelamento", cheque_especial: "Cheque especial", outro: "Outra dívida" };
export const PAYMENT: Record<string, string> = { pix: "Pix", debito: "Débito", credito: "Crédito", dinheiro: "Dinheiro", boleto: "Boleto", transferencia: "Transferência" };
export const RECURRENCE: Record<string, string> = { nenhuma: "Não recorrente", mensal: "Mensal", semanal: "Semanal", anual: "Anual" };
export const KIND: Record<string, string> = { expense: "Despesa", income: "Receita extra", card_payment: "Pagamento de fatura" };
export const GOAL_TYPE: Record<string, string> = { reserva: "Reserva de emergência", veiculo: "Veículo", imovel: "Imóvel", viagem: "Viagem", equipamento: "Equipamentos", quitar_divida: "Quitar dívidas", investimento: "Investir", independencia: "Independência financeira", outro: "Outro" };
export const PRIORITY: Record<string, string> = { "1": "Alta", "2": "Média", "3": "Baixa" };
export const GOAL_STATUS: Record<string, string> = { ativa: "Ativa", pausada: "Pausada", concluida: "Concluída" };
export const HORIZON: Record<string, string> = { curto: "Curto prazo (até 2 anos)", longo: "Longo prazo" };
export const BUCKET: Record<string, string> = { essenciais: "Essenciais", pessoais: "Pessoais", lazer: "Lazer", financeiro: "Financeiro" };
