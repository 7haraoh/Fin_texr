"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Calculator, ChartLine, CreditCard, FileText, LayoutDashboard, LogOut, Menu, Moon, PiggyBank, Receipt, Settings,
  ShieldCheck, Sparkles, Sun, Target, UserRound, Wallet, X,
} from "lucide-react";
import { signOut } from "@/app/actions";
import { cx } from "./ui";
import { ChatWidget } from "./chat";

const NAV = [
  { href: "/", label: "Minha saúde financeira", icon: LayoutDashboard },
  { href: "/consultor", label: "Consultor IA", icon: Sparkles },
  { href: "/despesas", label: "Despesas", icon: Receipt },
  { href: "/orcamento", label: "Orçamento", icon: Wallet },
  { href: "/metas", label: "Metas", icon: Target },
  { href: "/simulador", label: "Simulador de compras", icon: Calculator },
  { href: "/reserva", label: "Reserva e proteção", icon: ShieldCheck },
  { href: "/cartoes", label: "Cartões e dívidas", icon: CreditCard },
  { href: "/projecoes", label: "Projeções", icon: ChartLine },
  { href: "/relatorio", label: "Relatório mensal", icon: FileText },
  { href: "/perfil", label: "Perfil financeiro", icon: UserRound },
  { href: "/configuracoes", label: "Dados e privacidade", icon: Settings },
];

export function ThemeToggle() {
  const [dark, setDark] = useState<boolean | null>(null);
  useEffect(() => setDark(document.documentElement.classList.contains("dark")), []);
  const toggle = () => {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    try { localStorage.setItem("theme", next ? "dark" : "light"); } catch {}
    setDark(next);
  };
  return (
    <button onClick={toggle} className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-fg" aria-label="Alternar tema claro/escuro">
      {dark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const path = usePathname();
  return (
    <nav className="flex flex-col gap-0.5">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? path === "/" : path.startsWith(href);
        return (
          <Link key={href} href={href} onClick={onNavigate}
            className={cx("flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition",
              active ? "bg-accent-soft font-medium text-accent" : "text-muted hover:bg-surface-2 hover:text-fg")}>
            <Icon size={17} strokeWidth={1.8} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2.5 px-3">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-accent-fg">
        <PiggyBank size={18} />
      </span>
      <span className="text-[15px] font-semibold tracking-tight">Finance OS</span>
    </Link>
  );
}

export function AppShell({ children, userLabel }: { children: React.ReactNode; userLabel: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-dvh lg:pl-64">
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-line bg-surface px-3 py-5 lg:flex">
        <Brand />
        <div className="mt-6 flex-1 overflow-y-auto"><NavLinks /></div>
        <UserBox userLabel={userLabel} />
      </aside>

      {open && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setOpen(false)}>
          <aside className="flex h-full w-72 flex-col bg-surface px-3 py-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between"><Brand /><button onClick={() => setOpen(false)} className="p-2 text-muted" aria-label="Fechar menu"><X size={18} /></button></div>
            <div className="mt-6 flex-1 overflow-y-auto"><NavLinks onNavigate={() => setOpen(false)} /></div>
            <UserBox userLabel={userLabel} />
          </aside>
        </div>
      )}

      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-bg/85 px-4 backdrop-blur lg:px-8">
        <button onClick={() => setOpen(true)} className="rounded-lg p-2 text-muted hover:bg-surface-2 lg:hidden" aria-label="Abrir menu"><Menu size={20} /></button>
        <span className="text-xs text-faint max-lg:hidden">Valores em R$ · Horário de Brasília</span>
        <ThemeToggle />
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 lg:px-8 lg:py-8">{children}</main>
      <ChatWidget />
    </div>
  );
}

function UserBox({ userLabel }: { userLabel: string }) {
  return (
    <div className="mt-4 border-t border-line pt-4">
      <div className="truncate px-3 text-xs text-faint" title={userLabel}>{userLabel}</div>
      <form action={signOut}>
        <button className="mt-2 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted hover:bg-surface-2 hover:text-fg">
          <LogOut size={17} strokeWidth={1.8} /> Sair
        </button>
      </form>
    </div>
  );
}
