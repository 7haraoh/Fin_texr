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

if (typeof window !== "undefined") {
  window.addEventListener("hashchange", () => {
    const v = readHash();
    if (v !== state.view) { state = { view: v, params: {} }; emit(); }
  });
}

function emit() { listeners.forEach((l) => l()); }

export function navigate(href: string) {
  const url = new URL(href, "https://x.invalid");
  const seg = url.pathname.replace(/^\/+/, "").split("/")[0];
  const view = ((VIEWS as readonly string[]).includes(seg) ? seg : "") as View;
  state = { view, params: Object.fromEntries(url.searchParams), anchor: url.hash.replace(/^#/, "") || undefined };
  try { history.replaceState(null, "", view ? `#${view}` : location.pathname + location.search); } catch { /* sandbox */ }
  emit();
  setTimeout(() => {
    if (state.anchor) document.getElementById(state.anchor)?.scrollIntoView({ behavior: "smooth" });
    else window.scrollTo({ top: 0 });
  }, 50);
}

export function useRoute(): RouteState {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => state, () => state);
}
