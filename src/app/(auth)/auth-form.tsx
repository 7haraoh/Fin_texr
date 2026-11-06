"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { buttonClass } from "@/components/ui";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null); setInfo(null);
    const supabase = createClient();
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.replace("/");
        router.refresh();
      } else {
        if (password.length < 10) throw new Error("Use uma senha com pelo menos 10 caracteres.");
        const { data, error } = await supabase.auth.signUp({
          email, password,
          options: { data: { full_name: name }, emailRedirectTo: `${window.location.origin}/auth/callback` },
        });
        if (error) throw error;
        if (data.session) { router.replace("/perfil?boas-vindas=1"); router.refresh(); }
        else setInfo("Enviamos um link de confirmação para o seu e-mail. Confirme para entrar.");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro inesperado";
      setError(msg === "Invalid login credentials" ? "E-mail ou senha incorretos." : msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">{mode === "login" ? "Entrar" : "Criar conta"}</h1>
        <p className="mt-1 text-xs text-muted">{mode === "login" ? "Acesse sua inteligência financeira." : "Comece a construir sua estabilidade financeira."}</p>
      </div>
      {mode === "signup" && (
        <div>
          <label className="mb-1 block text-xs font-medium text-muted" htmlFor="name">Como prefere ser chamado(a)</label>
          <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoComplete="given-name" />
        </div>
      )}
      <div>
        <label className="mb-1 block text-xs font-medium text-muted" htmlFor="email">E-mail</label>
        <input id="email" type="email" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted" htmlFor="password">Senha</label>
        <input id="password" type="password" required minLength={mode === "signup" ? 10 : 6} className="input" value={password}
          onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} />
        {mode === "signup" && <p className="mt-1 text-xs text-faint">Mínimo de 10 caracteres.</p>}
      </div>
      {error && <p className="text-sm text-neg">{error}</p>}
      {info && <p className="text-sm text-pos">{info}</p>}
      <button disabled={busy} className={`${buttonClass("primary")} w-full`}>{busy ? "Aguarde…" : mode === "login" ? "Entrar" : "Criar conta"}</button>
      <p className="text-center text-xs text-muted">
        {mode === "login" ? <>Ainda não tem conta? <Link href="/cadastro" className="font-medium text-accent">Cadastre-se</Link></>
          : <>Já tem conta? <Link href="/login" className="font-medium text-accent">Entrar</Link></>}
      </p>
    </form>
  );
}
