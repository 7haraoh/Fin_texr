"use client";

import { useState, useTransition } from "react";
import { deleteAccount } from "@/app/actions";
import { buttonClass } from "./ui";

export function DeleteAccount() {
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">Remove permanentemente sua conta, todos os lançamentos, metas, conversas e histórico. Esta ação não pode ser desfeita — exporte seus dados antes.</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input className="input sm:max-w-xs" placeholder='Digite "EXCLUIR" para confirmar' value={text} onChange={(e) => setText(e.target.value)} aria-label="Confirmação de exclusão" />
        <button disabled={text !== "EXCLUIR" || pending} className={buttonClass("danger")}
          onClick={() => start(async () => {
            const r = await deleteAccount(text);
            if (r.ok) window.location.href = "/login"; else setErr(r.error);
          })}>{pending ? "Excluindo…" : "Excluir conta permanentemente"}</button>
      </div>
      {err && <p className="text-sm text-neg">{err}</p>}
    </div>
  );
}
