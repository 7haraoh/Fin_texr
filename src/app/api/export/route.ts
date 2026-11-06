import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/finance/dates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TABLES: [string, string][] = [
  ["profiles", "Perfil"], ["income_sources", "Renda"], ["assets", "Patrimônio"], ["debts", "Dívidas"],
  ["credit_cards", "Cartões"], ["categories", "Categorias"], ["transactions", "Lançamentos"], ["goals", "Metas"],
  ["budget_plans", "Orçamentos"], ["category_limits", "Limites"], ["monthly_snapshots", "Evolução"], ["chat_messages", "Conversas"],
  ["audit_log", "Histórico"],
];
const MONEY = /amount|value|balance|payment|limit|net_worth|liquid|reserve|debt|contribution/;

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Não autenticado", { status: 401 });
  const format = new URL(req.url).searchParams.get("format") === "json" ? "json" : "xlsx";

  const dump: Record<string, unknown[]> = {};
  for (const [t] of TABLES) {
    const { data, error } = await supabase.from(t).select("*").limit(50000);
    if (error) return new Response(`Erro ao exportar ${t}`, { status: 500 });
    dump[t] = data ?? [];
  }
  const stamp = todayISO();

  if (format === "json") {
    return new Response(JSON.stringify({ exportado_em: new Date().toISOString(), usuario: user.email, dados: dump }, null, 2), {
      headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="finance-os-${stamp}.json"`, "Cache-Control": "no-store" },
    });
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = "Finance OS";
  for (const [t, label] of TABLES) {
    const rows = dump[t] as Record<string, unknown>[];
    const ws = wb.addWorksheet(label);
    const cols = rows.length ? Object.keys(rows[0]).filter((c) => c !== "user_id") : ["(vazio)"];
    ws.columns = cols.map((c) => ({ header: c, key: c, width: Math.min(40, Math.max(12, c.length + 2)) }));
    ws.getRow(1).font = { bold: true };
    for (const r of rows) {
      ws.addRow(Object.fromEntries(cols.map((c) => {
        const v = r[c];
        if (v !== null && typeof v === "object") return [c, JSON.stringify(v)];
        if (typeof v === "string" && MONEY.test(c) && v !== "" && !Number.isNaN(Number(v))) return [c, Number(v)];
        if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) { const [y, m, d] = v.split("-").map(Number); return [c, new Date(Date.UTC(y, m - 1, d))]; }
        return [c, v];
      })));
    }
    cols.forEach((c, i) => {
      if (MONEY.test(c)) ws.getColumn(i + 1).numFmt = '"R$" #,##0.00';
      if (/_on$|^month$|deadline|_date$/.test(c)) ws.getColumn(i + 1).numFmt = "dd/mm/yyyy";
    });
  }
  const buf = await wb.xlsx.writeBuffer();
  return new Response(buf as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="finance-os-${stamp}.xlsx"`, "Cache-Control": "no-store",
    },
  });
}
