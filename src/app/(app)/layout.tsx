import { AppShell } from "@/components/shell";
import { requireUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-sm">
        <h1 className="text-xl font-semibold">Configuração pendente</h1>
        <p className="mt-2 text-muted">Defina as variáveis de ambiente do Supabase (veja <code>.env.example</code> e o README) e execute a migração em <code>supabase/migrations</code>.</p>
      </div>
    );
  }
  const { supabase, user } = await requireUser();
  const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
  return <AppShell userLabel={profile?.full_name || user.email || "Minha conta"}>{children}</AppShell>;
}
