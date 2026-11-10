// Roteamento por "#nome" (o único formato de hash que o visualizador repassa).
// Parâmetros de consulta ficam só em memória.
import { useSyncExternalStore } from "react";

export const VIEWS = ["lancamentos", "consultor", "plano", "mais", "analise", "despesas", "orcamento", "metas", "simulador", "reserva", "cartoes", "projecoes", "relatorio", "perfil", "dados"] as const;
export type View = "" | (typeof VIEWS)[number];

interface RouteState { view: View; params: Record<string, string>; anchor?: string }
let state: RouteState = { view: readHash(), params: {} };
const listeners = new Set<() => void>();

function readHash(): View {
  const h = (typeof location !== "undefined" ? location.hash : "").replace(/^#/, "");
  return (VIEWS as readonly string[]).includes(h) ? (h as View) : "";
}

// Últimos parâmetros de cada tela, para o "voltar" reabrir como estava
const lastParams = new Map<View, Record<string, string>>();

if (typeof window !== "undefined") {
  window.addEventListener("hashchange", () => {
    const v = readHash();
    if (v !== state.view) { state = { view: v, params: lastParams.get(v) ?? {} }; emit(); window.scrollTo({ top: 0 }); }
  });
}

function emit() { listeners.forEach((l) => l()); }

export function navigate(href: string) {
  const url = new URL(href, "https://x.invalid");
  const seg = url.pathname.replace(/^\/+/, "").split("/")[0];
  const view = ((VIEWS as readonly string[]).includes(seg) ? seg : "") as View;
  const params = Object.fromEntries(url.searchParams);
  lastParams.set(view, params);
  const changed = view !== state.view;
  state = { view, params, anchor: url.hash.replace(/^#/, "") || undefined };
  // Cada troca de tela vira uma entrada no histórico: o "voltar" do celular funciona
  try { if (changed) location.hash = view || "inicio"; } catch { /* sandbox */ }
  emit();
  setTimeout(() => {
    if (state.anchor) document.getElementById(state.anchor)?.scrollIntoView({ behavior: "smooth" });
    else window.scrollTo({ top: 0 });
  }, 50);
}

export function useRoute(): RouteState {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => state, () => state);
}
