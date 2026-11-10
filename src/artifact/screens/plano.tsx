import { useState, type ReactNode } from "react";
import { brl } from "@/lib/finance/format";
import { num } from "@/lib/finance/types";
import { buttonClass, cx } from "@/components/ui";
import { navigate, useRoute } from "../router";
import { analysisNow } from "../data-shim";
import { relevantCycle } from "../cycle";
import { billPayments } from "../store";
import { Panel } from "./common";
import { SavingSheet } from "./sheets";

const TABS = [["orcamento", "Orçamento"], ["metas", "Metas"], ["reserva", "Reserva"]] as const;

function QuickSave() {
  const { data, analysis, today } = analysisNow();
  const { cycle } = relevantCycle(data, analysis, today, billPayments());
  const [goal, setGoal] = useState<{ id: string; name: string } | null>(null);
  const active = analysis.goals.filter((g) => g.goal.status === "ativa");
  if (!active.length) return null;
  const plannedFor = (id: string) => {
    const g = data.goals.find((x) => x.id === id)!;
    const planned = num(g.schedule?.[cycle.key] ?? g.monthly_contribution);
    const saved = data.transactions.filter((t) => t.notes === `goal:${id}` && t.occurred_on >= cycle.savingStart && t.occurred_on < cycle.end).reduce((x, t) => x + num(t.amount), 0);
    return { planned, saved, left: Math.max(0, planned - saved) };
  };
  return (
    <Panel className="divide-y divide-line overflow-hidden">
      {active.map((g) => {
        const p = plannedFor(g.goal.id);
        return (
          <div key={g.goal.id} className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <div className="truncate text-[15px] font-semibold">{g.goal.name}</div>
              <div className="num text-[13px] text-muted">{brl(g.current)} de {brl(g.target)} · neste salário {brl(p.saved)} de {brl(p.planned)}</div>
            </div>
            <button onClick={() => setGoal({ id: g.goal.id, name: g.goal.name })} className={cx(buttonClass("primary", "sm"), "rounded-full px-4")}>Guardar</button>
          </div>
        );
      })}
      <SavingSheet goal={goal} suggested={goal ? plannedFor(goal.id).left : 0} onClose={() => setGoal(null)} />
    </Panel>
  );
}

export function Plano({ render }: { render: (tab: "orcamento" | "metas" | "reserva") => ReactNode }) {
  const { params } = useRoute();
  const tab = (TABS.some(([k]) => k === params.aba) ? params.aba : "orcamento") as "orcamento" | "metas" | "reserva";
  return (
    <div className="space-y-5 pt-1">
      <h1 className="text-[28px] font-semibold tracking-tight">Plano</h1>
      <div className="grid grid-cols-3 gap-1 rounded-full bg-surface-2 p-1 text-[14px] font-medium">
        {TABS.map(([k, l]) => (
          <button key={k} onClick={() => navigate(`/plano?aba=${k}`)} className={cx("rounded-full py-2 transition", tab === k ? "bg-surface shadow-sm" : "text-muted")}>{l}</button>
        ))}
      </div>
      {tab !== "orcamento" && <QuickSave />}
      <div className="embedded">{render(tab)}</div>
    </div>
  );
}
