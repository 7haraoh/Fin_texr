"use client";

import { dec1 } from "@/lib/finance/format";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveBudgetPlan } from "@/app/actions";
import { ALLOCATION_LABELS, ALLOCATION_ORDER } from "@/lib/finance/budget";
import type { AllocationKey } from "@/lib/finance/types";
import { brl } from "@/lib/finance/format";
import { parseBRNumber, CrudSection, type FieldDef } from "./forms";
import { buttonClass, cx, Money, Progress } from "./ui";
import type { Category, CategoryLimit } from "@/lib/finance/types";

const fmtInput = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function BudgetEditor({ income, suggested, saved }: {
  income: number; suggested: Record<AllocationKey, number>; saved: Partial<Record<AllocationKey, number>> | null;
}) {
  const router = useRouter();
  const initial = saved ?? suggested;
  const [vals, setVals] = useState<Record<string, string>>(() => Object.fromEntries(ALLOCATION_ORDER.map((k) => [k, fmtInput(Number(initial[k] ?? 0))])));
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const nums = Object.fromEntries(ALLOCATION_ORDER.map((k) => [k, Number(parseBRNumber(vals[k]) || 0)])) as Record<AllocationKey, number>;
  const total = ALLOCATION_ORDER.reduce((s, k) => s + nums[k], 0);
  const diff = income - total;

  const save = () => start(async () => {
    const r = await saveBudgetPlan(nums);
    setMsg(r.ok ? { ok: true, text: "Orçamento do mês salvo." } : { ok: false, text: r.error });
    if (r.ok) router.refresh();
  });

  return (
    <div>
      <div className="space-y-3">
        {ALLOCATION_ORDER.map((k) => (
          <div key={k} className="grid grid-cols-[1fr_auto] items-center gap-3 sm:grid-cols-[1fr_9rem_7rem]">
            <div>
              <div className="text-sm">{ALLOCATION_LABELS[k]}</div>
              <div className="text-[11px] text-faint">Sugestão: {brl(suggested[k])}</div>
            </div>
            <div className="relative">
              <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-faint">R$</span>
              <input className="input num py-1.5 pl-8 text-right" inputMode="decimal" value={vals[k]} aria-label={ALLOCATION_LABELS[k]}
                onChange={(e) => setVals((p) => ({ ...p, [k]: e.target.value }))} />
            </div>
            <div className="num hidden text-right text-xs text-muted sm:block">{income > 0 ? `${dec1(((nums[k] / income) * 100))}%` : "—"}</div>
          </div>
        ))}
      </div>
      <div className={cx("mt-4 flex items-center justify-between rounded-lg px-3 py-2 text-sm", Math.abs(diff) < 0.01 ? "bg-accent-soft" : "bg-surface-2")}>
        <span>Total distribuído: <strong className="num">{brl(total)}</strong> de {brl(income)}</span>
        <span className={cx("num font-medium", diff < -0.01 ? "text-neg" : diff > 0.01 ? "text-warn" : "text-pos")}>
          {Math.abs(diff) < 0.01 ? "Fechado ✓" : diff > 0 ? `${brl(diff)} sem destino` : `${brl(-diff)} acima da renda`}
        </span>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
        {msg && <span className={msg.ok ? "text-sm text-pos" : "text-sm text-neg"}>{msg.text}</span>}
        <button type="button" onClick={() => setVals(Object.fromEntries(ALLOCATION_ORDER.map((k) => [k, fmtInput(suggested[k])])))} className={buttonClass("outline")}>Usar sugestão</button>
        <button type="button" onClick={save} disabled={pending} className={buttonClass("primary")}>{pending ? "Salvando…" : "Salvar orçamento do mês"}</button>
      </div>
    </div>
  );
}

export function CategoryLimitsSection({ rows, categories, spentById }: {
  rows: CategoryLimit[]; categories: Category[]; spentById: Record<string, number>;
}) {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const fields: FieldDef[] = [
    { name: "category_id", label: "Categoria", type: "select", required: true, options: categories.map((c) => ({ value: c.id, label: `${c.group_name} › ${c.name}` })) },
    { name: "monthly_limit", label: "Limite mensal", type: "money", required: true },
  ];
  return (
    <CrudSection table="category_limits" rows={rows} fields={fields} addLabel="Definir limite"
      emptyTitle="Nenhum limite por categoria" emptyText="Defina tetos para categorias que tendem a escapar do controle (ex.: delivery, roupas)."
      columns={[
        { label: "Categoria", render: (r) => byId.get(r.category_id)?.name ?? "—" },
        { label: "Consumo", render: (r) => {
          const lim = Number(r.monthly_limit), sp = spentById[r.category_id] ?? 0;
          return <div className="w-full min-w-28"><Progress value={lim ? sp / lim : 0} tone="auto" /><div className="mt-1 text-[11px] text-faint num">{brl(sp)} de {brl(lim)}</div></div>;
        } },
        { label: "Disponível", align: "right", render: (r) => <Money value={Number(r.monthly_limit) - (spentById[r.category_id] ?? 0)} signed /> },
      ]} />
  );
}
