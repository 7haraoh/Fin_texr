import { Calculator, ChartLine, ChartPie, ChevronRight, CreditCard, FileText, Receipt, Settings, UserRound } from "lucide-react";
import { navigate } from "../router";
import { Panel, Row } from "./common";

const GROUPS = [
  { title: "Análises", items: [
    { href: "/analise", label: "Saúde financeira completa", sub: "Indicadores, gráficos e alertas", icon: ChartPie },
    { href: "/projecoes", label: "Projeções", sub: "Cenários de 6 meses a 5 anos", icon: ChartLine },
    { href: "/relatorio", label: "Relatório mensal", sub: "O que foi bem e prioridades", icon: FileText },
  ] },
  { title: "Ferramentas", items: [
    { href: "/simulador", label: "Simulador de compras", sub: "Avalie antes de comprar", icon: Calculator },
    { href: "/cartoes", label: "Cartões e dívidas", sub: "Faturas, limites e parcelas", icon: CreditCard },
    { href: "/despesas", label: "Despesas por categoria", sub: "Padrões de consumo e categorias", icon: Receipt },
  ] },
  { title: "Conta", items: [
    { href: "/perfil", label: "Perfil financeiro", sub: "Renda, patrimônio, estilo de vida", icon: UserRound },
    { href: "/dados", label: "Dados e privacidade", sub: "Exportar e apagar dados", icon: Settings },
  ] },
];

export function Mais() {
  return (
    <div className="space-y-6 pt-1">
      <h1 className="text-[28px] font-semibold tracking-tight">Mais</h1>
      {GROUPS.map((g) => (
        <section key={g.title} className="space-y-2">
          <h2 className="px-1 text-[13px] font-semibold uppercase tracking-[0.06em] text-muted">{g.title}</h2>
          <Panel className="divide-y divide-line overflow-hidden">
            {g.items.map(({ href, label, sub, icon: Icon }) => (
              <Row key={href} onClick={() => navigate(href)}
                left={<span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent"><Icon size={18} /></span>}
                title={label} subtitle={sub} right={<ChevronRight size={18} className="text-faint" />} />
            ))}
          </Panel>
        </section>
      ))}
    </div>
  );
}
