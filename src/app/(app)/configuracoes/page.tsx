import Link from "next/link";
import { Download, FileText, ShieldCheck } from "lucide-react";
import { requireUser } from "@/lib/supabase/server";
import { Card, PageHeader, buttonClass } from "@/components/ui";
import { DeleteAccount } from "@/components/danger-zone";
import { dateBR } from "@/lib/finance/format";

export const metadata = { title: "Dados e privacidade" };

const TABLE_LABEL: Record<string, string> = {
  income_sources: "Renda", assets: "Patrimônio", debts: "Dívida", credit_cards: "Cartão", transactions: "Lançamento",
  budget_plans: "Orçamento", category_limits: "Limite", goals: "Meta",
};
const ACTION_LABEL: Record<string, string> = { INSERT: "criado", UPDATE: "alterado", DELETE: "excluído" };

export default async function Configuracoes() {
  const { supabase, user } = await requireUser();
  const { data: log } = await supabase.from("audit_log").select("id, table_name, action, changed_at, new_data, old_data").order("changed_at", { ascending: false }).limit(25);
  return (
    <>
      <PageHeader title="Dados e privacidade" subtitle={`Conta: ${user.email}`} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Exportar meus dados" subtitle="Todos os seus registros, a qualquer momento">
          <div className="flex flex-wrap gap-2">
            <a href="/api/export?format=xlsx" className={buttonClass("primary")}><Download size={16} /> Excel (.xlsx)</a>
            <a href="/api/export?format=json" className={buttonClass("outline")}><Download size={16} /> JSON completo</a>
            <Link href="/relatorio" className={buttonClass("outline")}><FileText size={16} /> Relatório mensal (PDF)</Link>
          </div>
          <p className="mt-3 text-xs text-faint">O relatório pode ser salvo em PDF pela opção “Imprimir” do navegador.</p>
        </Card>
        <Card title="Segurança" action={<ShieldCheck size={18} className="text-pos" />}>
          <ul className="list-disc space-y-1 pl-4 text-sm text-muted">
            <li>Dados isolados por usuário (Row Level Security) e criptografados em trânsito e em repouso.</li>
            <li>Nunca solicitamos senhas bancárias ou números de cartão.</li>
            <li>A IA recebe apenas um resumo agregado necessário para cada análise.</li>
          </ul>
          <Link href="/privacidade" className="mt-3 inline-block text-sm font-medium text-accent">Ler a política de privacidade →</Link>
        </Card>
      </div>

      <Card className="mt-6" title="Histórico de alterações" subtitle="Últimas 25 alterações nos seus registros">
        {!log?.length ? <p className="text-sm text-muted">Nenhuma alteração registrada ainda.</p> : (
          <ul className="divide-y divide-line text-sm">
            {log.map((l) => {
              const rec = (l.new_data ?? l.old_data) as Record<string, unknown> | null;
              const name = String(rec?.description ?? rec?.name ?? "");
              return (
                <li key={l.id} className="flex justify-between gap-3 py-2">
                  <span><span className="font-medium">{TABLE_LABEL[l.table_name] ?? l.table_name}</span> {ACTION_LABEL[l.action] ?? l.action}{name && <span className="text-muted"> · {name}</span>}</span>
                  <span className="shrink-0 text-xs text-faint">{dateBR(new Date(l.changed_at).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }))}</span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card className="mt-6 border-neg/40" title="Excluir conta">
        <DeleteAccount />
      </Card>
    </>
  );
}
