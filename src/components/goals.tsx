"use client";

import { CrudSection, type FieldDef } from "./forms";
import { Badge, Money, Progress } from "./ui";
import { GOAL_STATUS, GOAL_TYPE, HORIZON, PRIORITY, opts } from "@/lib/labels";
import type { Goal } from "@/lib/finance/types";
import { dateBR, pct } from "@/lib/finance/format";

const fields: FieldDef[] = [
  { name: "name", label: "Nome da meta", type: "text", required: true, placeholder: "Ex.: Viagem para o Chile" },
  { name: "type", label: "Tipo", type: "select", required: true, options: opts(GOAL_TYPE) },
  { name: "target_amount", label: "Valor desejado", type: "money", required: true },
  { name: "current_amount", label: "Valor já acumulado", type: "money" },
  { name: "deadline", label: "Prazo", type: "date" },
  { name: "monthly_contribution", label: "Aporte mensal planejado", type: "money" },
  { name: "priority", label: "Prioridade", type: "select", required: true, options: opts(PRIORITY) },
  { name: "horizon", label: "Horizonte", type: "select", required: true, options: opts(HORIZON) },
  { name: "status", label: "Situação", type: "select", required: true, options: opts(GOAL_STATUS) },
];

export function GoalsSection({ rows }: { rows: Goal[] }) {
  return (
    <CrudSection table="goals" rows={rows} fields={fields} addLabel="Nova meta"
      defaults={{ type: "outro", priority: "2", horizon: "curto", status: "ativa", current_amount: 0, monthly_contribution: 0 }}
      emptyTitle="Nenhuma meta" emptyText="Comece pela reserva de emergência — ela protege todas as outras metas."
      columns={[
        { label: "Meta", render: (r) => <div><div className="font-medium">{r.name}</div><div className="text-xs text-faint">{GOAL_TYPE[r.type]} · prioridade {PRIORITY[String(r.priority)].toLowerCase()}</div></div> },
        { label: "Progresso", render: (r) => { const p = Number(r.target_amount) ? Number(r.current_amount) / Number(r.target_amount) : 0; return <div className="min-w-28"><Progress value={p} tone="pos" /><div className="mt-1 text-[11px] text-faint">{pct(p)}</div></div>; } },
        { label: "Prazo", hideOnMobile: true, render: (r) => <span className="text-xs text-muted">{dateBR(r.deadline)}</span> },
        { label: "Valor", align: "right", render: (r) => <span><Money value={Number(r.current_amount)} /> <span className="text-faint">/ <Money value={Number(r.target_amount)} /></span></span> },
        { label: "", hideOnMobile: true, render: (r) => r.status !== "ativa" ? <Badge>{GOAL_STATUS[r.status]}</Badge> : null },
      ]} />
  );
}
