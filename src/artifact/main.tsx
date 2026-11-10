import { createRoot } from "react-dom/client";
import { useEffect, useState, type ReactNode } from "react";
import { House, List, LoaderCircle, Menu, Plus, Sparkles, Target, Moon, Sun } from "lucide-react";
import { Notice, cx } from "@/components/ui";
import { navigate, useRoute, type View } from "./router";
import { initStore, useStore } from "./store";
import { ChatPanel } from "./chat";
import Dados from "./dados";
import { analysisNow } from "./data-shim";
import { Home } from "./screens/home";
import { Lancamentos } from "./screens/lancamentos";
import { Plano } from "./screens/plano";
import { Mais } from "./screens/mais";
import { QuickAdd } from "./screens/quick-add";
import { BackHeader } from "./screens/common";

import Dashboard from "@/app/(app)/page";
import Despesas from "@/app/(app)/despesas/page";
import Orcamento from "@/app/(app)/orcamento/page";
import Metas from "@/app/(app)/metas/page";
import Simulador from "@/app/(app)/simulador/page";
import Reserva from "@/app/(app)/reserva/page";
import Cartoes from "@/app/(app)/cartoes/page";
import Projecoes from "@/app/(app)/projecoes/page";
import Relatorio from "@/app/(app)/relatorio/page";
import Perfil from "@/app/(app)/perfil/page";

type PageFn = (props: { searchParams: Promise<Record<string, string>> }) => ReactNode | Promise<ReactNode>;

/** Executa uma tela do app (função assíncrona) e renderiza o resultado; refaz a cada mudança nos dados. */
function AsyncPage({ page, params, version }: { page: PageFn; params: Record<string, string>; version: number }) {
  const [el, setEl] = useState<ReactNode>(null);
  useEffect(() => {
    let alive = true;
    Promise.resolve(page({ searchParams: Promise.resolve(params) }))
      .then((e) => alive && setEl(e))
      .catch((err) => alive && setEl(<Notice tone="neg">Não foi possível exibir esta tela: {String(err?.message ?? err)}</Notice>));
    return () => { alive = false; };
  }, [page, params, version]);
  return <>{el}</>;
}

const TABS: { view: View; href: string; label: string; icon: typeof House; match: View[] }[] = [
  { view: "", href: "/", label: "Início", icon: House, match: [""] },
  { view: "lancamentos", href: "/lancamentos", label: "Lançamentos", icon: List, match: ["lancamentos"] },
  { view: "consultor", href: "/consultor", label: "Consultor", icon: Sparkles, match: ["consultor"] },
  { view: "plano", href: "/plano", label: "Plano", icon: Target, match: ["plano", "orcamento", "metas", "reserva"] },
  { view: "mais", href: "/mais", label: "Mais", icon: Menu, match: ["mais", "analise", "despesas", "simulador", "cartoes", "projecoes", "relatorio", "perfil", "dados"] },
];

const SUBPAGES: Partial<Record<View, { page?: PageFn; title: string }>> = {
  analise: { page: Dashboard as PageFn, title: "Saúde financeira" },
  despesas: { page: Despesas as PageFn, title: "Despesas por categoria" },
  simulador: { page: Simulador as PageFn, title: "Simulador" },
  cartoes: { page: Cartoes as PageFn, title: "Cartões e dívidas" },
  projecoes: { page: Projecoes as PageFn, title: "Projeções" },
  relatorio: { page: Relatorio as PageFn, title: "Relatório" },
  perfil: { page: Perfil as PageFn, title: "Perfil financeiro" },
  dados: { title: "Dados e privacidade" },
  orcamento: { page: Orcamento as PageFn, title: "Orçamento" },
  metas: { page: Metas as PageFn, title: "Metas" },
  reserva: { page: Reserva as PageFn, title: "Reserva" },
};

function ThemeButton() {
  const isDark = () => {
    const t = document.documentElement.getAttribute("data-theme");
    return t ? t === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
  };
  const [dark, setDark] = useState(isDark);
  return (
    <button aria-label="Alternar tema claro/escuro" className="rounded-full p-2 text-muted hover:bg-surface-2"
      onClick={() => {
        const next = !dark;
        document.documentElement.setAttribute("data-theme", next ? "dark" : "light");
        try { localStorage.setItem("finance-os:theme", next ? "dark" : "light"); } catch { /* opcional */ }
        setDark(next);
      }}>
      {dark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}

function App() {
  const store = useStore();
  const route = useRoute();
  const [adding, setAdding] = useState(false);
  useEffect(() => { initStore(); }, []);

  const v = route.view;
  const active = TABS.find((t) => t.match.includes(v)) ?? TABS[0];
  const sub = SUBPAGES[v];
  const showFab = store.status === "ready" && (v === "" || v === "lancamentos");

  let body: ReactNode;
  if (store.status === "loading") {
    body = <div className="flex items-center justify-center gap-2 py-24 text-sm text-muted"><LoaderCircle size={16} className="animate-spin" /> Carregando seus dados…</div>;
  } else if (store.status === "error") {
    body = <Notice tone="neg">{store.error}</Notice>;
  } else if (v === "") body = <Home />;
  else if (v === "lancamentos") body = <Lancamentos />;
  else if (v === "mais") body = <Mais />;
  else if (v === "consultor") {
    body = (
      <div className="chat-screen flex flex-col pt-1">
        <h1 className="mb-3 text-[28px] font-semibold tracking-tight">Consultor</h1>
        <div className="panel min-h-0 flex-1 p-3"><ChatPanel /></div>
      </div>
    );
  } else if (v === "plano") {
    body = <Plano render={(tab) => <AsyncPage page={(tab === "metas" ? Metas : tab === "reserva" ? Reserva : Orcamento) as PageFn} params={route.params} version={store.version} />} />;
  } else if (sub) {
    const fromPlano = v === "orcamento" || v === "metas" || v === "reserva";
    body = (
      <div className="pt-1">
        <BackHeader title={sub.title} back={fromPlano ? "/plano" : "/mais"} backLabel={fromPlano ? "Plano" : "Mais"} />
        {v === "dados" ? <Dados /> : <AsyncPage page={sub.page!} params={route.params} version={store.version} />}
      </div>
    );
  }

  return (
    <div className="shell min-h-full lg:pl-60">
      {/* Barra lateral (computador) */}
      <aside className="rail fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-line bg-bg px-3 lg:flex">
        <div className="flex items-center justify-between px-3 pb-6">
          <span className="text-[17px] font-semibold tracking-tight">Finance OS</span>
          <ThemeButton />
        </div>
        <nav className="flex flex-col gap-1">
          {TABS.map((t) => (
            <button key={t.href} onClick={() => navigate(t.href)}
              className={cx("flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] transition", active === t ? "bg-surface font-semibold text-fg shadow-sm" : "text-muted hover:text-fg")}>
              <t.icon size={19} strokeWidth={active === t ? 2.2 : 1.8} /> {t.label}
            </button>
          ))}
        </nav>
        {store.status === "ready" && (
          <button onClick={() => setAdding(true)} className="mt-6 flex items-center justify-center gap-2 rounded-full bg-accent py-2.5 text-[15px] font-semibold text-accent-fg">
            <Plus size={18} /> Novo lançamento
          </button>
        )}
        {store.backend === "local" && <p className="mt-auto px-3 pb-2 text-[11px] text-warn">Dados salvos só neste navegador.</p>}
      </aside>

      {/* Topo (celular) */}
      <header className="topbar sticky z-30 flex h-12 items-center justify-end bg-bg/85 backdrop-blur lg:hidden">
        <ThemeButton />
      </header>

      <main className="gutter mx-auto max-w-3xl pb-28 lg:py-8">{body}</main>

      {showFab && (
        <button onClick={() => setAdding(true)} aria-label="Novo lançamento" className="fab fixed z-40 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-fg shadow-lg lg:hidden">
          <Plus size={26} strokeWidth={2.4} />
        </button>
      )}

      {/* Abas (celular) */}
      <nav className="tabbar fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-line bg-bg/92 backdrop-blur lg:hidden">
        {TABS.map((t) => (
          <button key={t.href} onClick={() => navigate(t.href)} aria-current={active === t ? "page" : undefined}
            className={cx("flex flex-col items-center gap-1 pb-1.5 pt-2 text-[10.5px] font-medium", active === t ? "text-accent" : "text-faint")}>
            <t.icon size={22} strokeWidth={active === t ? 2.3 : 1.8} />
            {t.label}
          </button>
        ))}
      </nav>

      {store.status === "ready" && (
        <QuickAddMount open={adding} onClose={() => setAdding(false)} />
      )}
    </div>
  );
}

function QuickAddMount({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data } = analysisNow();
  return <QuickAdd open={open} onClose={onClose} categories={data.categories} cards={data.cards} transactions={data.transactions} />;
}

try {
  const t = localStorage.getItem("finance-os:theme");
  if (t) document.documentElement.setAttribute("data-theme", t);
} catch { /* opcional */ }

createRoot(document.getElementById("root")!).render(<App />);
