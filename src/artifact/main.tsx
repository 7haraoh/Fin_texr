import { createRoot } from "react-dom/client";
import { useEffect, useState, type ReactNode } from "react";
import {
  Calculator, ChartLine, CreditCard, FileText, LayoutDashboard, Menu, Moon, PiggyBank, Receipt, Settings,
  ShieldCheck, Sparkles, Sun, Target, UserRound, Wallet, X, LoaderCircle,
} from "lucide-react";
import { cx, Notice } from "@/components/ui";
import Link from "./shims/next-link";
import { useRoute, type View } from "./router";
import { initStore, useStore } from "./store";
import { ChatWidget } from "./chat";
import Dados from "./dados";

import Dashboard from "@/app/(app)/page";
import Consultor from "@/app/(app)/consultor/page";
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
const PAGES: Record<Exclude<View, "dados">, PageFn> = {
  "": Dashboard as PageFn, consultor: Consultor as PageFn, despesas: Despesas as PageFn, orcamento: Orcamento as PageFn,
  metas: Metas as PageFn, simulador: Simulador as PageFn, reserva: Reserva as PageFn, cartoes: Cartoes as PageFn,
  projecoes: Projecoes as PageFn, relatorio: Relatorio as PageFn, perfil: Perfil as PageFn,
};

const NAV: { view: View; label: string; icon: typeof LayoutDashboard }[] = [
  { view: "", label: "Minha saúde financeira", icon: LayoutDashboard },
  { view: "consultor", label: "Consultor IA", icon: Sparkles },
  { view: "despesas", label: "Despesas", icon: Receipt },
  { view: "orcamento", label: "Orçamento", icon: Wallet },
  { view: "metas", label: "Metas", icon: Target },
  { view: "simulador", label: "Simulador de compras", icon: Calculator },
  { view: "reserva", label: "Reserva e proteção", icon: ShieldCheck },
  { view: "cartoes", label: "Cartões e dívidas", icon: CreditCard },
  { view: "projecoes", label: "Projeções", icon: ChartLine },
  { view: "relatorio", label: "Relatório mensal", icon: FileText },
  { view: "perfil", label: "Perfil financeiro", icon: UserRound },
  { view: "dados", label: "Dados e privacidade", icon: Settings },
];

/** Executa a página (função assíncrona das telas do app) e renderiza o resultado; refaz a cada mudança nos dados. */
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

function ThemeToggle() {
  const isDark = () => {
    const t = document.documentElement.getAttribute("data-theme");
    return t ? t === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
  };
  const [dark, setDark] = useState(isDark);
  const toggle = () => {
    const next = !dark;
    document.documentElement.setAttribute("data-theme", next ? "dark" : "light");
    try { localStorage.setItem("finance-os:theme", next ? "dark" : "light"); } catch { /* opcional */ }
    setDark(next);
  };
  return (
    <button onClick={toggle} className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-fg" aria-label="Alternar tema claro/escuro">
      {dark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const { view } = useRoute();
  return (
    <nav className="flex flex-col gap-0.5">
      {NAV.map(({ view: v, label, icon: Icon }) => (
        <Link key={v || "inicio"} href={`/${v}`} onClick={onNavigate}
          className={cx("flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition",
            view === v ? "bg-accent-soft font-medium text-accent" : "text-muted hover:bg-surface-2 hover:text-fg")}>
          <Icon size={17} strokeWidth={1.8} /> {label}
        </Link>
      ))}
    </nav>
  );
}

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2.5 px-3">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-accent-fg"><PiggyBank size={18} /></span>
      <span className="text-[15px] font-semibold tracking-tight">Finance OS</span>
    </Link>
  );
}

function App() {
  const store = useStore();
  const route = useRoute();
  const [open, setOpen] = useState(false);
  useEffect(() => { initStore(); }, []);

  let body: ReactNode;
  if (store.status === "loading") {
    body = <div className="flex items-center gap-2 py-24 text-sm text-muted justify-center"><LoaderCircle size={16} className="animate-spin" /> Carregando seus dados…</div>;
  } else if (store.status === "error") {
    body = <Notice tone="neg">{store.error}</Notice>;
  } else if (route.view === "dados") {
    body = <Dados />;
  } else {
    body = <AsyncPage page={PAGES[route.view]} params={route.params} version={store.version} />;
  }

  return (
    <div className="app min-h-full lg:pl-64">
      <aside className="sidebar fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-line bg-surface px-3 py-5 lg:flex">
        <Brand />
        <div className="mt-6 flex-1 overflow-y-auto"><NavLinks /></div>
        {store.backend === "local" && <p className="px-3 text-[11px] text-warn">Dados salvos só neste navegador.</p>}
      </aside>

      {open && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setOpen(false)}>
          <aside className="drawer flex h-full w-72 max-w-[85vw] flex-col bg-surface px-3 py-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between"><Brand /><button onClick={() => setOpen(false)} className="p-2 text-muted" aria-label="Fechar menu"><X size={18} /></button></div>
            <div className="mt-6 flex-1 overflow-y-auto"><NavLinks onNavigate={() => setOpen(false)} /></div>
          </aside>
        </div>
      )}

      <header className="topbar sticky z-30 flex h-14 items-center justify-between border-b border-line bg-bg/90 backdrop-blur">
        <button onClick={() => setOpen(true)} className="rounded-lg p-2 text-muted hover:bg-surface-2 lg:hidden" aria-label="Abrir menu"><Menu size={20} /></button>
        <span className="text-xs text-faint max-lg:hidden">Valores em R$ · Horário de Brasília</span>
        <span className="text-sm font-semibold lg:hidden">Finance OS</span>
        <ThemeToggle />
      </header>

      <main className="gutter mx-auto max-w-7xl py-6 lg:py-8">{body}</main>
      {store.status === "ready" && <ChatWidget />}
    </div>
  );
}

try {
  const t = localStorage.getItem("finance-os:theme");
  if (t) document.documentElement.setAttribute("data-theme", t);
} catch { /* opcional */ }

createRoot(document.getElementById("root")!).render(<App />);
