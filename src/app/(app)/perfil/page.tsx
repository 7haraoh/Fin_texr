import { loadAnalysis } from "@/lib/data";
import { Card, Notice, PageHeader, Stat } from "@/components/ui";
import { AssetSection, CardSection, DebtSection, IncomeSection } from "@/components/entities";
import { LifestyleForm } from "@/components/lifestyle-form";
import { brl } from "@/lib/finance/format";

export const metadata = { title: "Perfil financeiro" };

export default async function Perfil({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const { data, analysis } = await loadAnalysis();
  const s = analysis.snapshot;
  return (
    <>
      <PageHeader title="Perfil financeiro" subtitle="Preencha aos poucos e atualize sempre que algo mudar. Renda (fluxo), patrimônio (estoque) e obrigações são tratados separadamente para evitar contagem dupla." />
      {"boas-vindas" in sp && (
        <div className="mb-6"><Notice>Bem-vindo(a)! Comece pela <strong>renda líquida</strong> e pelos <strong>saldos atuais</strong>. Em poucos minutos o painel e o consultor já conseguem analisar sua situação.</Notice></div>
      )}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Renda líquida mensal" value={brl(s.income.monthlyNet)} />
        <Stat label="Patrimônio total" value={brl(s.assets.total)} />
        <Stat label="Dívidas totais" value={brl(s.debts.totalOutstanding)} />
        <Stat label="Patrimônio líquido" value={brl(s.netWorth)} tone={s.netWorth < 0 ? "neg" : undefined} />
      </div>
      <div className="space-y-6">
        <Card title="Renda" subtitle="Salários, benefícios e outras fontes. Rendas eventuais entram como “Receita extra” em Despesas.">
          <IncomeSection rows={data.incomes} />
        </Card>
        <div id="patrimonio" className="scroll-mt-20">
          <Card title="Patrimônio" subtitle="Saldos e valores atuais: contas, espécie, poupança, investimentos e bens.">
            <AssetSection rows={data.assets} />
          </Card>
        </div>
        <div id="obrigacoes" className="scroll-mt-20 grid gap-6 lg:grid-cols-2">
          <Card title="Empréstimos e financiamentos" subtitle="Obrigações com parcelas fixas.">
            <DebtSection rows={data.debts} />
          </Card>
          <Card title="Cartões de crédito" subtitle="Compras no cartão são lançadas em Despesas; faturas são calculadas automaticamente.">
            <CardSection rows={data.cards} />
          </Card>
        </div>
        <div id="estilo" className="scroll-mt-20">
          <Card title="Estilo de vida e comportamento" subtitle="Ajuda o consultor a criar recomendações realistas, equilibrando dinheiro, liberdade e qualidade de vida.">
            <LifestyleForm profile={data.profile} />
          </Card>
        </div>
      </div>
    </>
  );
}
