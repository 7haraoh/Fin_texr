import type { ReactNode } from "react";
import { cx } from "@/components/ui";
import { navigate, useRoute } from "../router";

const TABS = [["orcamento", "Orçamento"], ["metas", "Metas"], ["reserva", "Reserva"]] as const;

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
      <div className="embedded">{render(tab)}</div>
    </div>
  );
}
