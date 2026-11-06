import "server-only";
import { cache } from "react";
import { requireUser } from "./supabase/server";
import { todayISO, monthStart } from "./finance/dates";
import type { FinancialData } from "./finance/types";
import { analyze } from "./finance/analyze";

/** Carrega todos os dados do usuário autenticado (RLS garante o isolamento). */
export const loadFinancialData = cache(async (): Promise<{ data: FinancialData; today: string; userId: string; email: string | null }> => {
  const { supabase, user } = await requireUser();
  const today = todayISO();
  const month = monthStart(today);
  const q = <T,>(p: PromiseLike<{ data: T | null; error: { message: string } | null }>) =>
    Promise.resolve(p).then((r) => {
      if (r.error) throw new Error(r.error.message);
      return r.data;
    });

  const [profile, incomes, assets, debts, cards, categories, transactions, goals, budgetPlan, categoryLimits, snapshots] =
    await Promise.all([
      q(supabase.from("profiles").select("id, full_name, risk_profile, lifestyle").eq("id", user.id).maybeSingle()),
      q(supabase.from("income_sources").select("*").order("created_at")),
      q(supabase.from("assets").select("*").order("created_at")),
      q(supabase.from("debts").select("*").order("created_at")),
      q(supabase.from("credit_cards").select("*").order("created_at")),
      q(supabase.from("categories").select("*").order("group_name").order("name")),
      q(supabase.from("transactions").select("*").order("occurred_on", { ascending: false }).order("created_at", { ascending: false }).limit(5000)),
      q(supabase.from("goals").select("*").order("priority").order("created_at")),
      q(supabase.from("budget_plans").select("id, month, allocations").eq("month", month).maybeSingle()),
      q(supabase.from("category_limits").select("*")),
      q(supabase.from("monthly_snapshots").select("month, net_worth, liquid_assets, emergency_reserve, total_debt").order("month").limit(60)),
    ]);

  return {
    today,
    userId: user.id,
    email: user.email ?? null,
    data: {
      profile: (profile as FinancialData["profile"]) ?? null,
      incomes: (incomes ?? []) as FinancialData["incomes"],
      assets: (assets ?? []) as FinancialData["assets"],
      debts: (debts ?? []) as FinancialData["debts"],
      cards: (cards ?? []) as FinancialData["cards"],
      categories: (categories ?? []) as FinancialData["categories"],
      transactions: (transactions ?? []) as FinancialData["transactions"],
      goals: (goals ?? []) as FinancialData["goals"],
      budgetPlan: (budgetPlan as FinancialData["budgetPlan"]) ?? null,
      categoryLimits: (categoryLimits ?? []) as FinancialData["categoryLimits"],
      snapshots: (snapshots ?? []) as FinancialData["snapshots"],
    },
  };
});

export const loadAnalysis = cache(async () => {
  const loaded = await loadFinancialData();
  return { ...loaded, analysis: analyze(loaded.data, loaded.today) };
});

/** Registra a fotografia patrimonial do mês corrente (constrói o histórico). */
export async function recordMonthlySnapshot() {
  const { data, analysis, today, userId } = await loadAnalysis();
  if (!data.assets.length && !data.debts.length && !data.cards.length) return;
  const { supabase } = await requireUser();
  const s = analysis.snapshot;
  await supabase.from("monthly_snapshots").upsert(
    {
      user_id: userId,
      month: monthStart(today),
      net_worth: s.netWorth,
      liquid_assets: s.assets.liquid,
      emergency_reserve: s.assets.reserve,
      total_debt: s.debts.totalOutstanding,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,month" },
  );
}
