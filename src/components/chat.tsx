"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Bot, Eraser, LoaderCircle, Maximize2, Send, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { clearChat } from "@/app/actions";
import { Markdown } from "./markdown";
import { buttonClass, cx } from "./ui";

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

export function ChatPanel({ compact }: { compact?: boolean }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/advisor")
      .then((r) => (r.ok ? r.json() : { messages: [] }))
      .then((d) => setMessages(d.messages ?? []))
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages]);

  const send = useCallback(async (text: string) => {
    const content = text.trim();
    if (!content || busy) return;
    setError(null);
    setInput("");
    setBusy(true);
    setMessages((m) => [...m, { role: "user", content }, { role: "assistant", content: "" }]);
    try {
      const res = await fetch("/api/advisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: content }),
      });
      if (!res.ok || !res.body) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Não foi possível falar com o consultor.");
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = dec.decode(value, { stream: true });
        setMessages((m) => {
          const copy = [...m];
          copy[copy.length - 1] = { role: "assistant", content: copy[copy.length - 1].content + chunk };
          return copy;
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro inesperado");
      setMessages((m) => (m[m.length - 1]?.content === "" ? m.slice(0, -1) : m));
    } finally {
      setBusy(false);
    }
  }, [busy]);

  const reset = async () => {
    if (!confirm("Apagar todo o histórico de conversa?")) return;
    await clearChat();
    setMessages([]);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className={cx("flex-1 space-y-4 overflow-y-auto", compact ? "px-4 py-4" : "px-1 py-2")}>
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
          {messages.length > 0 && <button type="button" onClick={reset} className="flex items-center gap-1 hover:text-fg"><Eraser size={12} /> Limpar</button>}
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
