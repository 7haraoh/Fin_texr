// Substitui src/app/actions.ts: mesma validação (zod), gravação no armazenamento da página.
import { z } from "zod";
import { EDITABLE_TABLES, type EditableTable, allocationsSchema, profileSchema, schemas } from "@/lib/validation/schemas";
import { monthKey, todayISO } from "@/lib/finance/dates";
import { compareCashVsInstallments, evaluatePurchase } from "@/lib/finance/purchase";
import { COLLECTIONS, deleteRow, getState, putRow, uid, type CollectionName } from "./store";
import { DEFAULT_CATEGORIES } from "./defaults";
import { analysisNow } from "./data-shim";

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string; fieldErrors?: Record<string, string> };

function fail(err: unknown): ActionResult {
  if (err instanceof z.ZodError) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of err.issues) {
      const k = issue.path.join(".");
      if (!fieldErrors[k]) fieldErrors[k] = issue.message;
    }
    return { ok: false, error: "Verifique os campos destacados.", fieldErrors };
  }
  return { ok: false, error: err instanceof Error ? err.message : "Erro inesperado" };
}

/** Registra a fotografia patrimonial do mês após cada alteração. */
async function snapshotMonth() {
  try {
    const { analysis, data } = analysisNow();
    if (!data.assets.length && !data.debts.length && !data.cards.length) return;
    const s = analysis.snapshot;
    await putRow("monthly_snapshots", s.monthKey, {
      net_worth: s.netWorth, liquid_assets: s.assets.liquid, emergency_reserve: s.assets.reserve, total_debt: s.debts.totalOutstanding,
    });
  } catch { /* não crítico */ }
}

function findRow(table: CollectionName, id: string) {
  return getState().rows[table].find((r) => r.id === id);
}

export async function saveRecord(table: string, payload: Record<string, unknown>, id?: string): Promise<ActionResult> {
  try {
    if (!EDITABLE_TABLES.includes(table as EditableTable)) throw new Error("Operação não permitida");
    const t = table as EditableTable;
    const values = schemas[t].parse(payload) as Record<string, unknown>;
    const now = new Date().toISOString();
    if (t === "category_limits") {
      const existing = getState().rows.category_limits.find((r) => r.category_id === values.category_id);
      const rid = existing?.id ?? uid();
      await putRow(t, rid, { ...values, created_at: existing?.created_at ?? now });
      await snapshotMonth();
      return { ok: true, id: rid };
    }
    if (t === "categories" && id && DEFAULT_CATEGORIES.some((c) => c.id === id)) values.is_custom = false;
    const rid = id ?? uid();
    const prev = id ? findRow(t, id) : undefined;
    await putRow(t, rid, { ...values, created_at: (prev?.created_at as string) ?? now, updated_at: now });
    await snapshotMonth();
    return { ok: true, id: rid };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteRecord(table: string, id: string): Promise<ActionResult> {
  try {
    if (!EDITABLE_TABLES.includes(table as EditableTable)) throw new Error("Operação não permitida");
    if (table === "categories" && DEFAULT_CATEGORIES.some((c) => c.id === id)) throw new Error("Categorias padrão não podem ser excluídas.");
    await deleteRow(table as CollectionName, id);
    await snapshotMonth();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function saveBudgetPlan(allocations: Record<string, unknown>): Promise<ActionResult> {
  try {
    const parsed = allocationsSchema.parse(allocations);
    await putRow("budget_plans", monthKey(todayISO()), { allocations: parsed, updated_at: new Date().toISOString() });
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function saveProfile(payload: Record<string, unknown>): Promise<ActionResult> {
  try {
    const parsed = profileSchema.parse(payload);
    const lifestyle = Object.fromEntries(Object.entries(parsed.lifestyle).filter(([, v]) => v !== null));
    await putRow("meta", "profile", { full_name: parsed.full_name, risk_profile: parsed.risk_profile, lifestyle });
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function clearChat(): Promise<ActionResult> {
  try {
    for (const m of getState().rows.chat_messages) await deleteRow("chat_messages", m.id);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function signOut() { /* a sessão é a da sua conta claude.ai */ }

/** Apaga permanentemente todos os dados financeiros guardados na página. */
export async function deleteAccount(confirmation: string): Promise<ActionResult> {
  try {
    if (confirmation !== "EXCLUIR") throw new Error('Digite "EXCLUIR" para confirmar.');
    for (const name of COLLECTIONS) for (const r of getState().rows[name]) await deleteRow(name, r.id);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

const simSchema = z.object({
  item: z.string().trim().min(1).max(120),
  price: z.coerce.number().positive().max(1e10),
  method: z.enum(["avista", "credito_parcelado", "financiado"]),
  installments: z.coerce.number().int().min(1).max(420),
  monthlyInterestPct: z.coerce.number().min(0).max(30),
  cashDiscountPct: z.coerce.number().min(0).max(90),
  need: z.enum(["necessidade", "melhoria", "desejo"]),
  yieldMonthlyPct: z.coerce.number().min(0).max(5),
});

export async function simulatePurchase(input: Record<string, unknown>) {
  try {
    const p = simSchema.parse(input);
    const { analysis } = analysisNow();
    const evaluation = evaluatePurchase(analysis.snapshot, analysis.reserve, {
      item: p.item, price: p.price, method: p.method, installments: p.method === "avista" ? 1 : p.installments,
      monthlyInterestPct: p.monthlyInterestPct, cashDiscountPct: p.cashDiscountPct, need: p.need,
    });
    const comparison = compareCashVsInstallments(p.price, p.cashDiscountPct, Math.max(2, p.installments), p.monthlyInterestPct, p.yieldMonthlyPct);
    return { ok: true as const, evaluation, comparison };
  } catch (e) {
    return { ok: false as const, error: e instanceof z.ZodError ? "Verifique os valores informados." : (e as Error).message };
  }
}
