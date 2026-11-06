import { useState } from "react";
import { Download, ShieldCheck } from "lucide-react";
import { Card, PageHeader, buttonClass } from "@/components/ui";
import { DeleteAccount } from "@/components/danger-zone";
import { COLLECTIONS, getState, useStore } from "./store";
import { todayISO } from "@/lib/finance/dates";

type Downloads = { save(f: { filename: string; data: Blob | string }): Promise<unknown> };
declare global { interface Window { XLSX?: { utils: { book_new(): unknown; json_to_sheet(rows: unknown[]): unknown; book_append_sheet(wb: unknown, ws: unknown, name: string): void }; write(wb: unknown, o: { bookType: string; type: string }): ArrayBuffer } } }

const LABEL: Record<string, string> = {
  income_sources: "Renda", assets: "Patrimônio", debts: "Dívidas", credit_cards: "Cartões", categories: "Categorias",
  transactions: "Lançamentos", goals: "Metas", category_limits: "Limites", budget_plans: "Orçamentos",
  monthly_snapshots: "Evolução", chat_messages: "Conversas", meta: "Perfil",
};

export default function Dados() {
  const store = useStore();
  const [msg, setMsg] = useState<string | null>(null);
  const total = COLLECTIONS.reduce((s, c) => s + store.rows[c].length, 0);

  const save = async (kind: "json" | "xlsx") => {
    setMsg(null);
    const downloads = (await window.claude?.use("downloads")) as Downloads | null;
    if (!downloads) { setMsg("A exportação só funciona com a página aberta no claude.ai."); return; }
    const rows = getState().rows;
    try {
      if (kind === "json") {
        await downloads.save({ filename: `finance-os-${todayISO()}.json`, data: new Blob([JSON.stringify({ exportado_em: new Date().toISOString(), dados: rows }, null, 2)], { type: "application/json" }) });
      } else {
        const X = window.XLSX;
        if (!X) throw new Error("Biblioteca de planilhas não carregou.");
        const wb = X.utils.book_new();
        for (const c of COLLECTIONS) {
          const data = rows[c].map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v !== null && typeof v === "object" ? JSON.stringify(v) : v])));
          X.utils.book_append_sheet(wb, X.utils.json_to_sheet(data.length ? data : [{ vazio: "" }]), LABEL[c]);
        }
        const buf = X.write(wb, { bookType: "xlsx", type: "array" });
        await downloads.save({ filename: `finance-os-${todayISO()}.xlsx`, data: new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }) });
      }
      setMsg("Arquivo pronto.");
    } catch (e) {
      setMsg((e as Error).message || "Exportação cancelada.");
    }
  };

  return (
    <>
      <PageHeader title="Dados e privacidade" subtitle={`${total} registros guardados`} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Exportar meus dados" subtitle="Todos os seus registros, a qualquer momento">
          <div className="flex flex-wrap gap-2">
            <button onClick={() => save("xlsx")} className={buttonClass("primary")}><Download size={16} /> Excel (.xlsx)</button>
            <button onClick={() => save("json")} className={buttonClass("outline")}><Download size={16} /> JSON completo</button>
          </div>
          {msg && <p className="mt-3 text-sm text-muted">{msg}</p>}
        </Card>
        <Card title="Onde seus dados ficam" action={<ShieldCheck size={18} className="text-pos" />}>
          <ul className="list-disc space-y-1 pl-4 text-sm text-muted">
            {store.backend === "db" ? (
              <li>Num espaço privado desta página, ligado à sua conta claude.ai. Só você lê e altera esses dados, de qualquer aparelho em que estiver conectado.</li>
            ) : (
              <li>Apenas neste navegador (página aberta fora do claude.ai). Abra pelo link do claude.ai para guardar na sua conta e acessar de qualquer aparelho.</li>
            )}
            <li>Nunca peça nem informe senhas bancárias ou números de cartão.</li>
            <li>O consultor recebe um resumo calculado da sua situação, sem observações livres nem nomes de instituições.</li>
            <li>As análises são educacionais; para investimentos, impostos ou crédito complexos, procure um profissional habilitado.</li>
          </ul>
        </Card>
      </div>
      <Card className="mt-6" title="Apagar todos os dados">
        <DeleteAccount />
      </Card>
    </>
  );
}
