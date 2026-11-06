"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ADVISOR_SYSTEM_PROMPT } from "@/lib/ai/prompt";
import { buildAdvisorContext } from "@/lib/ai/context";
import { ADVISOR_TOOLS, runAdvisorTool } from "@/lib/ai/tools";
import { analysisNow } from "./data-shim";
import { chatMessages, putRow, uid, useStore } from "./store";
import { Bot, Eraser, LoaderCircle, Maximize2, Send, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { clearChat } from "./actions-shim";
import { Markdown } from "@/components/markdown";
import { buttonClass, cx } from "@/components/ui";

interface Msg { role: "user" | "assistant"; content: string }

export const SUGGESTIONS = [
  "Qual é minha situação financeira atual?",
  "Quanto posso gastar hoje?",
  "Posso comprar um celular de R$ 3.000?",
  "Estou gastando demais?",
  "Quanto devo guardar neste mês?",
  "Quais despesas posso reduzir?",
  "Estou preparado para uma emergência?",
  "Minha renda permite assumir um financiamento?",
];

type Sample = ((input: { role: "user" | "assistant"; content: string }[], opts: Record<string, unknown>) => Promise<{ text: string }>);
let samplePromise: Promise<Sample | null> | null = null;
const getSample = () => (samplePromise ??= (window.claude?.use("sample") as Promise<Sample | null> | undefined) ?? Promise.resolve(null));

const SAMPLE_ERRORS: Record<string, string> = {
  not_granted: "Permita que esta página use o Claude (menu de permissões da página) para conversar com o consultor.",
  rate_limited: "Muitas perguntas em pouco tempo. Aguarde um instante e tente novamente.",
  prompt_too_large: "A conversa ficou longa demais. Limpe o histórico e tente de novo.",
  sampling_disabled: "O uso do Claude está desativado para esta página.",
  refused: "Não consigo ajudar com esse pedido. Posso apoiar em outras questões sobre suas finanças.",
};

export function ChatPanel({ compact }: { compact?: boolean }) {
  const store = useStore();
  const stored = chatMessages();
  const [pending, setPending] = useState<Msg[]>([]);
  const messages: Msg[] = [...stored.map((m) => ({ role: m.role, content: m.content })), ...pending];
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loaded = store.status === "ready";
  const endRef = useRef<HTMLDivElement>(null);
  const [available, setAvailable] = useState<boolean | null>(null);

  useEffect(() => { getSample().then((s) => setAvailable(!!s)); }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages.length, pending]);

  const send = useCallback(async (text: string) => {
    const content = text.trim();
    if (!content || busy) return;
    const sample = await getSample();
    if (!sample) { setError("O consultor só funciona com a página aberta no claude.ai."); return; }
    setError(null);
    setInput("");
    setBusy(true);
    setPending([{ role: "user", content }, { role: "assistant", content: "" }]);
    const now = Date.now();
    try {
      const { data, analysis, today } = analysisNow();
      const history = chatMessages().slice(-12);
      const msgs: { role: "user" | "assistant"; content: string }[] = [];
      for (const m of [...history, { role: "user" as const, content }]) {
        const last = msgs[msgs.length - 1];
        if (!last && m.role !== "user") continue;
        if (last && last.role === m.role) last.content += `\n\n${m.content}`;
        else msgs.push({ role: m.role, content: m.content });
      }
      msgs[0] = { role: "user", content: `${ADVISOR_SYSTEM_PROMPT}\n\n${buildAdvisorContext(data, analysis, today)}\n\n---\n\n${msgs[0].content}` };
      const tools = ADVISOR_TOOLS.map((t) => ({
        name: t.name,
        description: t.description ?? "",
        inputSchema: t.input_schema,
        execute: (inp: Record<string, unknown>) => JSON.parse(runAdvisorTool(t.name, inp, data, analysis)),
      }));
      const res = await sample(msgs, {
        tools, modelTier: "default", cache: false,
        onText: ({ text }: { text: string }) => setPending([{ role: "user", content }, { role: "assistant", content: text }]),
      });
      await putRow("chat_messages", uid(), { role: "user", content, created_at: new Date(now).toISOString() });
      if (res.text.trim()) await putRow("chat_messages", uid(), { role: "assistant", content: res.text, created_at: new Date(now + 1).toISOString() });
      setPending([]);
    } catch (e) {
      const err = e as { code?: string; message?: string; text?: string };
      setError(SAMPLE_ERRORS[err.code ?? ""] ?? "Não foi possível concluir a análise agora. Tente novamente.");
      setPending(err.text ? [{ role: "user", content }, { role: "assistant", content: err.text }] : []);
    } finally {
      setBusy(false);
    }
  }, [busy]);

  const [confirmReset, setConfirmReset] = useState(false);
  const reset = async () => {
    if (!confirmReset) { setConfirmReset(true); return; }
    setConfirmReset(false);
    await clearChat();
    setPending([]);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className={cx("flex-1 space-y-4 overflow-y-auto", compact ? "px-4 py-4" : "px-1 py-2")}>
        {available === false && <p className="rounded-lg bg-surface-2 p-3 text-xs text-muted">O consultor usa o Claude da sua conta e só funciona com a página aberta no claude.ai.</p>}
        {loaded && messages.length === 0 && (
          <div className="py-4">
            <div className="flex items-center gap-2 text-sm font-medium"><Sparkles size={16} className="text-accent" /> Seu consultor financeiro</div>
            <p className="mt-1 text-xs text-muted">Analiso seus dados cadastrados antes de responder: situação atual, impacto, riscos, consequências e recomendação. Não invento valores — se faltar informação, vou pedir.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {SUGGESTIONS.slice(0, compact ? 5 : 8).map((s) => (
                <button key={s} onClick={() => send(s)} className="rounded-full border border-line px-3 py-1.5 text-left text-xs text-muted hover:border-accent hover:text-fg">{s}</button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={cx("flex gap-2", m.role === "user" && "justify-end")}>
            {m.role === "assistant" && <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent"><Bot size={14} /></span>}
            <div className={cx("max-w-[88%] rounded-2xl px-3.5 py-2.5",
              m.role === "user" ? "bg-accent text-sm text-accent-fg" : "bg-surface-2")}>
              {m.role === "assistant"
                ? (m.content ? <Markdown text={m.content} /> : <span className="flex items-center gap-2 text-xs text-muted"><LoaderCircle size={14} className="animate-spin" /> Analisando seus dados…</span>)
                : <span className="whitespace-pre-wrap">{m.content}</span>}
            </div>
          </div>
        ))}
        {error && <p className="text-xs text-neg">{error}</p>}
        <div ref={endRef} />
      </div>
      <form onSubmit={(e) => { e.preventDefault(); send(input); }} className={cx("border-t border-line", compact ? "p-3" : "pt-3")}>
        <div className="flex items-end gap-2">
          <textarea value={input} onChange={(e) => setInput(e.target.value)} rows={1} maxLength={4000}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
            placeholder="Pergunte sobre suas finanças…" className="input max-h-40 min-h-[42px] resize-none" aria-label="Mensagem para o consultor" />
          <button type="submit" disabled={busy || !input.trim()} className={buttonClass("primary")} aria-label="Enviar"><Send size={16} /></button>
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px] text-faint">
          <span>Orientação educacional — não substitui profissional habilitado.</span>
          {messages.length > 0 && <button type="button" onClick={reset} className="flex items-center gap-1 hover:text-fg"><Eraser size={12} /> {confirmReset ? "Confirmar limpeza" : "Limpar"}</button>}
        </div>
      </form>
    </div>
  );
}

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  if (path.startsWith("/consultor")) return null;
  return (
    <>
      {!open && (
        <button onClick={() => setOpen(true)} className="no-print fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-accent px-4 py-3 text-sm font-medium text-accent-fg shadow-lg hover:brightness-110">
          <Sparkles size={18} /> <span className="max-sm:hidden">Consultor IA</span>
        </button>
      )}
      {open && (
        <div className="no-print fixed inset-0 z-50 flex justify-end bg-black/30 sm:inset-auto sm:bottom-5 sm:right-5 sm:bg-transparent">
          <div className="card flex h-full w-full flex-col overflow-hidden sm:h-[min(640px,85dvh)] sm:w-[420px]">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-semibold"><Sparkles size={16} className="text-accent" /> Consultor IA</div>
              <div className="flex gap-1">
                <Link href="/consultor" onClick={() => setOpen(false)} className={buttonClass("ghost", "sm")} aria-label="Abrir em tela cheia"><Maximize2 size={14} /></Link>
                <button onClick={() => setOpen(false)} className={buttonClass("ghost", "sm")} aria-label="Fechar"><X size={16} /></button>
              </div>
            </div>
            <div className="min-h-0 flex-1"><ChatPanel compact /></div>
          </div>
        </div>
      )}
    </>
  );
}
