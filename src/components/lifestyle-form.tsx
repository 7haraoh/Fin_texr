"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveProfile } from "@/app/actions";
import type { Profile } from "@/lib/finance/types";
import { buttonClass } from "./ui";

const TEXT_FIELDS: { key: string; label: string; placeholder: string }[] = [
  { key: "habits", label: "Hábitos de consumo", placeholder: "Ex.: compro roupas por impulso em promoções; peço delivery 3x por semana" },
  { key: "hobbies", label: "Hobbies e preferências", placeholder: "Ex.: fotografia, games, corrida" },
  { key: "food_habits", label: "Alimentação", placeholder: "Ex.: cozinho em casa durante a semana, restaurante aos fins de semana" },
  { key: "leisure", label: "Atividades de lazer", placeholder: "Ex.: shows, cinema, bares com amigos" },
  { key: "personal_goals", label: "Objetivos pessoais", placeholder: "Ex.: fazer pós-graduação, mudar de cidade" },
  { key: "desired_lifestyle", label: "Padrão de vida desejado", placeholder: "Como você gostaria de viver daqui a 5–10 anos?" },
  { key: "family_plans", label: "Planos familiares", placeholder: "Ex.: casar em 2 anos, ter filhos" },
  { key: "future_projects", label: "Projetos futuros", placeholder: "Ex.: abrir um negócio, comprar um apartamento" },
];

export function LifestyleForm({ profile }: { profile: Profile | null }) {
  const router = useRouter();
  const ls = (profile?.lifestyle ?? {}) as Record<string, unknown>;
  const [v, setV] = useState<Record<string, string>>(() => ({
    full_name: profile?.full_name ?? "",
    risk_profile: profile?.risk_profile ?? "",
    travel_frequency: String(ls.travel_frequency ?? ""),
    save_vs_enjoy: String(ls.save_vs_enjoy ?? "3"),
    dependents: ls.dependents !== undefined ? String(ls.dependents) : "",
    ...Object.fromEntries(TEXT_FIELDS.map((f) => [f.key, String(ls[f.key] ?? "")])),
  }));
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setV((p) => ({ ...p, [k]: e.target.value }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const r = await saveProfile({
        full_name: v.full_name, risk_profile: v.risk_profile,
        lifestyle: {
          travel_frequency: v.travel_frequency, save_vs_enjoy: v.save_vs_enjoy, dependents: v.dependents,
          ...Object.fromEntries(TEXT_FIELDS.map((f) => [f.key, v[f.key]])),
        },
      });
      setMsg(r.ok ? { ok: true, text: "Perfil salvo. O consultor já considera essas informações." } : { ok: false, text: r.error });
      if (r.ok) router.refresh();
    });
  };

  const enjoyLabels = ["Priorizo economizar", "Mais economizar", "Equilíbrio", "Mais aproveitar", "Priorizo aproveitar o presente"];
  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Nome</label>
          <input className="input" value={v.full_name} onChange={set("full_name")} maxLength={120} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Perfil de risco para investimentos</label>
          <select className="input" value={v.risk_profile} onChange={set("risk_profile")}>
            <option value="">Não sei / não informado</option>
            <option value="conservador">Conservador</option>
            <option value="moderado">Moderado</option>
            <option value="arrojado">Arrojado</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Dependentes financeiros</label>
          <input className="input" type="number" min={0} max={20} value={v.dependents} onChange={set("dependents")} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Frequência de viagens</label>
          <select className="input" value={v.travel_frequency} onChange={set("travel_frequency")}>
            <option value="">—</option>
            <option value="nunca">Não viajo</option>
            <option value="raramente">Raramente</option>
            <option value="anual">Uma vez por ano</option>
            <option value="semestral">Duas vezes por ano</option>
            <option value="frequente">Frequentemente</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-muted">Economizar × aproveitar o presente: <span className="text-fg">{enjoyLabels[Number(v.save_vs_enjoy) - 1]}</span></label>
          <input type="range" min={1} max={5} step={1} value={v.save_vs_enjoy} onChange={set("save_vs_enjoy")} className="w-full accent-[var(--accent)]" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {TEXT_FIELDS.map((f) => (
          <div key={f.key}>
            <label className="mb-1 block text-xs font-medium text-muted">{f.label}</label>
            <textarea className="input" rows={2} maxLength={1000} placeholder={f.placeholder} value={v[f.key]} onChange={set(f.key)} />
          </div>
        ))}
      </div>
      <div className="flex items-center justify-end gap-3">
        {msg && <span className={msg.ok ? "text-sm text-pos" : "text-sm text-neg"}>{msg.text}</span>}
        <button disabled={pending} className={buttonClass("primary")}>{pending ? "Salvando…" : "Salvar perfil"}</button>
      </div>
    </form>
  );
}
