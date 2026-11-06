// Armazenamento da versão publicada: banco da página (capability `db`) no caminho
// data/fin, com regra de acesso "somente o dono" (leitura e escrita). Assim o dono
// — e o Claude agindo a pedido dele numa conversa — podem ler e ajustar os dados;
// ninguém mais. Versões anteriores guardavam em data/users/<id>/fin: esses dados
// são migrados na primeira abertura. Sem o banco, usa o armazenamento local.

import { useSyncExternalStore } from "react";
import type { FinancialData, Profile } from "@/lib/finance/types";
import { todayISO, monthKey } from "@/lib/finance/dates";
import { DEFAULT_CATEGORIES } from "./defaults";

export const COLLECTIONS = [
  "income_sources", "assets", "debts", "credit_cards", "categories", "transactions",
  "goals", "category_limits", "budget_plans", "monthly_snapshots", "chat_messages", "meta",
] as const;
export type CollectionName = (typeof COLLECTIONS)[number];
export type Row = Record<string, unknown> & { id: string };

export interface ChatMsg { id: string; role: "user" | "assistant"; content: string; created_at: string }

interface Backend {
  kind: "db" | "local";
  subscribe(name: CollectionName, cb: (rows: Row[]) => void, onError: (msg: string) => void): void;
  set(name: CollectionName, id: string, data: Record<string, unknown>): Promise<void>;
  remove(name: CollectionName, id: string): Promise<void>;
}

type Status = "loading" | "ready" | "error";
interface State {
  status: Status;
  backend: "db" | "local" | null;
  error: string | null;
  rows: Record<CollectionName, Row[]>;
  version: number;
}

const empty = () => Object.fromEntries(COLLECTIONS.map((c) => [c, [] as Row[]])) as unknown as Record<CollectionName, Row[]>;
let state: State = { status: "loading", backend: null, error: null, rows: empty(), version: 0 };
const listeners = new Set<() => void>();
let backend: Backend | null = null;
let cachedData: { version: number; data: FinancialData } | null = null;

function setState(patch: Partial<State>) {
  state = { ...state, ...patch, version: state.version + 1 };
  listeners.forEach((l) => l());
}

export function useStore() {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => state, () => state);
}
export function getState() { return state; }

// ---------- Backends ----------

interface ClaudeDB {
  doc(path: string): { collection(p: string): ClaudeCollection };
}
interface ClaudeCollection {
  doc(id: string): { set(d: Record<string, unknown>): Promise<void>; delete(): Promise<void> };
  get(): Promise<{ docs: { id: string; data(): Record<string, unknown> | undefined }[] }>;
  onSnapshot(next: (s: { docs: { id: string; data(): Record<string, unknown> | undefined }[] }) => void, err?: (e: { message: string }) => void): () => void;
}
declare global {
  interface Window { claude?: { use(name: string): Promise<unknown> } }
}

export const DB_ROOT = "data/fin";

/** Move dados do caminho antigo (privado por pessoa) para data/fin, uma única vez. */
async function migrateLegacy(db: ClaudeDB, uid: string) {
  const oldRoot = db.doc(`data/users/${uid}/fin`);
  const newRoot = db.doc(DB_ROOT);
  for (const name of COLLECTIONS) {
    const [oldSnap, newSnap] = await Promise.all([oldRoot.collection(name).get(), newRoot.collection(name).get()]);
    if (!oldSnap.docs.length) continue;
    const existing = new Set(newSnap.docs.map((d) => d.id));
    for (const d of oldSnap.docs) {
      if (!existing.has(d.id)) await newRoot.collection(name).doc(d.id).set(d.data() ?? {});
      await oldRoot.collection(name).doc(d.id).delete();
    }
  }
}

function dbBackend(db: ClaudeDB): Backend {
  const root = db.doc(DB_ROOT);
  return {
    kind: "db",
    subscribe(name, cb, onError) {
      root.collection(name).onSnapshot((s) => cb(s.docs.map((d) => ({ ...(d.data() ?? {}), id: d.id }))), (e) => onError(e.message));
    },
    set: (name, id, data) => root.collection(name).doc(id).set(data),
    remove: (name, id) => root.collection(name).doc(id).delete(),
  };
}

function localBackend(): Backend {
  const KEY = "finance-os:v1";
  const subs = new Map<CollectionName, (rows: Row[]) => void>();
  const read = (): Record<string, Record<string, Row>> => { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; } };
  let mem = read();
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch { /* sem armazenamento: mantém em memória */ } };
  const push = (name: CollectionName) => subs.get(name)?.(Object.values(mem[name] ?? {}));
  return {
    kind: "local",
    subscribe(name, cb) { subs.set(name, cb); push(name); },
    async set(name, id, data) { mem = { ...mem, [name]: { ...(mem[name] ?? {}), [id]: { ...data, id } } }; persist(); push(name); },
    async remove(name, id) { const c = { ...(mem[name] ?? {}) }; delete c[id]; mem = { ...mem, [name]: c }; persist(); push(name); },
  };
}

export async function initStore() {
  let b: Backend | null = null;
  try {
    const [db, user] = await Promise.all([
      window.claude?.use("db") ?? Promise.resolve(null),
      window.claude?.use("user") ?? Promise.resolve(null),
    ]) as [ClaudeDB | null, { id(): Promise<string> } | null];
    if (db && user) {
      try { await migrateLegacy(db, await user.id()); } catch { /* sem dados antigos */ }
      b = dbBackend(db);
    }
  } catch { b = null; }
  backend = b ?? localBackend();
  setState({ backend: backend.kind });

  const loaded = new Set<CollectionName>();
  const timer = setTimeout(() => {
    if (state.status === "loading") setState({ status: "error", error: "Não foi possível carregar seus dados. Verifique a conexão e reabra a página." });
  }, 10_000);
  for (const name of COLLECTIONS) {
    backend.subscribe(name, (rows) => {
      loaded.add(name);
      const patch: Partial<State> = { rows: { ...state.rows, [name]: rows } };
      if (loaded.size === COLLECTIONS.length && state.status !== "ready") { clearTimeout(timer); patch.status = "ready"; patch.error = null; }
      setState(patch);
    }, (msg) => { clearTimeout(timer); setState({ status: "error", error: msg }); });
  }
}

export async function putRow(name: CollectionName, id: string, data: Record<string, unknown>) {
  if (!backend) throw new Error("Armazenamento indisponível");
  // Remove undefined (não serializável)
  const clean = JSON.parse(JSON.stringify({ ...data, id }));
  await backend.set(name, id, clean);
}
export async function deleteRow(name: CollectionName, id: string) {
  if (!backend) throw new Error("Armazenamento indisponível");
  await backend.remove(name, id);
}

// ---------- Visão FinancialData ----------

const num = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number(v));

export function financialData(): FinancialData {
  if (cachedData && cachedData.version === state.version) return cachedData.data;
  const r = state.rows;
  const overrides = new Map(r.categories.map((c) => [c.id, c]));
  const categories = [
    ...DEFAULT_CATEGORIES.map((c) => ({ ...c, ...(overrides.get(c.id) ?? {}), is_custom: false })),
    ...r.categories.filter((c) => !DEFAULT_CATEGORIES.some((d) => d.id === c.id)),
  ].sort((a, b) => String(a.group_name).localeCompare(String(b.group_name)) || String(a.name).localeCompare(String(b.name)));
  const byCreated = (a: Row, b: Row) => String(a.created_at ?? "").localeCompare(String(b.created_at ?? ""));
  const month = `${monthKey(todayISO())}`;
  const plan = r.budget_plans.find((p) => p.id === month);
  const profileRow = r.meta.find((m) => m.id === "profile");
  const data = {
    profile: { id: "me", full_name: (profileRow?.full_name as string) ?? null, risk_profile: (profileRow?.risk_profile as Profile["risk_profile"]) ?? null, lifestyle: (profileRow?.lifestyle as Profile["lifestyle"]) ?? {} },
    incomes: [...r.income_sources].sort(byCreated),
    assets: [...r.assets].sort(byCreated),
    debts: [...r.debts].sort(byCreated),
    cards: [...r.credit_cards].sort(byCreated),
    categories,
    transactions: [...r.transactions].sort((a, b) => String(b.occurred_on).localeCompare(String(a.occurred_on)) || String(b.created_at ?? "").localeCompare(String(a.created_at ?? ""))),
    goals: [...r.goals].sort((a, b) => Number(a.priority ?? 2) - Number(b.priority ?? 2) || byCreated(a, b)),
    budgetPlan: plan ? { id: plan.id, month: `${plan.id}-01`, allocations: (plan.allocations ?? {}) as Record<string, number> } : null,
    categoryLimits: r.category_limits.map((l) => ({ ...l, monthly_limit: num(l.monthly_limit) ?? 0 })),
    snapshots: [...r.monthly_snapshots].map((s) => ({ ...s, month: `${s.id}-01` })).sort((a, b) => a.month.localeCompare(b.month)),
  } as unknown as FinancialData;
  cachedData = { version: state.version, data };
  return data;
}

export function chatMessages(): ChatMsg[] {
  return (state.rows.chat_messages as unknown as ChatMsg[]).slice().sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export function uid(): string {
  return crypto.randomUUID();
}
