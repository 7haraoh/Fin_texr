"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/server";
import { EDITABLE_TABLES, EditableTable, allocationsSchema, profileSchema, schemas } from "@/lib/validation/schemas";
import { monthStart, todayISO } from "@/lib/finance/dates";

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
  const msg = err instanceof Error ? err.message : "Erro inesperado";
  return { ok: false, error: msg };
}

function assertTable(table: string): asserts table is EditableTable {
  if (!EDITABLE_TABLES.includes(table as EditableTable)) throw new Error("Operação não permitida");
}

export async function saveRecord(table: string, payload: Record<string, unknown>, id?: string): Promise<ActionResult> {
  try {
    assertTable(table);
    const { supabase, user } = await requireUser();
    const values = schemas[table].parse(payload) as Record<string, unknown>;
    if (table === "category_limits") {
      const { error } = await supabase.from(table).upsert({ ...values, user_id: user.id }, { onConflict: "user_id,category_id" });
      if (error) throw new Error(error.message);
      revalidatePath("/", "layout");
      return { ok: true };
    }
    if (id) {
      const { error } = await supabase.from(table).update(values).eq("id", id).eq("user_id", user.id);
      if (error) throw new Error(error.message);
      revalidatePath("/", "layout");
      return { ok: true, id };
    }
    const { data, error } = await supabase.from(table).insert({ ...values, user_id: user.id }).select("id").single();
    if (error) throw new Error(error.message);
    revalidatePath("/", "layout");
    return { ok: true, id: data.id as string };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteRecord(table: string, id: string): Promise<ActionResult> {
  try {
    assertTable(table);
    z.string().uuid().parse(id);
    const { supabase, user } = await requireUser();
    let q = supabase.from(table).delete().eq("id", id).eq("user_id", user.id);
    if (table === "categories") q = q.eq("is_custom", true); // categorias padrão não são removidas
    const { error } = await q;
    if (error) throw new Error(error.message);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function saveBudgetPlan(allocations: Record<string, unknown>): Promise<ActionResult> {
  try {
    const { supabase, user } = await requireUser();
    const parsed = allocationsSchema.parse(allocations);
    const { error } = await supabase.from("budget_plans").upsert(
      { user_id: user.id, month: monthStart(todayISO()), allocations: parsed },
      { onConflict: "user_id,month" },
    );
    if (error) throw new Error(error.message);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function saveProfile(payload: Record<string, unknown>): Promise<ActionResult> {
  try {
    const { supabase, user } = await requireUser();
    const parsed = profileSchema.parse(payload);
    const lifestyle = Object.fromEntries(Object.entries(parsed.lifestyle).filter(([, v]) => v !== null));
    const { error } = await supabase.from("profiles")
      .update({ full_name: parsed.full_name, risk_profile: parsed.risk_profile, lifestyle })
      .eq("id", user.id);
    if (error) throw new Error(error.message);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function clearChat(): Promise<ActionResult> {
  try {
    const { supabase, user } = await requireUser();
    const { error } = await supabase.from("chat_messages").delete().eq("user_id", user.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function signOut() {
  const { supabase } = await requireUser();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}

export async function deleteAccount(confirmation: string): Promise<ActionResult> {
  try {
    if (confirmation !== "EXCLUIR") throw new Error('Digite "EXCLUIR" para confirmar.');
    const { supabase } = await requireUser();
    const { error } = await supabase.rpc("delete_my_account");
    if (error) throw new Error(error.message);
    await supabase.auth.signOut();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ---------- Simulações (cálculo determinístico no servidor) ----------

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
  const { loadAnalysis } = await import("@/lib/data");
  const { evaluatePurchase, compareCashVsInstallments } = await import("@/lib/finance/purchase");
  try {
    const p = simSchema.parse(input);
    const { analysis } = await loadAnalysis();
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
