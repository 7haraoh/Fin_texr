import { useMemo, useState, useTransition } from "react";
import type { Category, CreditCard, Transaction } from "@/lib/finance/types";
import { todayISO } from "@/lib/finance/dates";
import { parseBRNumber, EntityForm } from "@/components/forms";
import { transactionFields } from "@/components/transactions";
import { buttonClass, cx } from "@/components/ui";
import { saveRecord } from "../actions-shim";
import { CatIcon, Sheet } from "./common";

/** Lançamento rápido: valor grande, categoria por ícone, o resto pré-preenchido. */
export function QuickAdd({ open, onClose, categories, cards, transactions }: {
  open: boolean; onClose: () => void; categories: Category[]; cards: CreditCard[]; transactions: Transaction[];
}) {
  const [kind, setKind] = useState<"expense" | "income">("expense");
  const [amount, setAmount] = useState("");
  const [catId, setCatId] = useState<string | null>(null);
  const [desc, setDesc] = useState("");
  const [date, setDate] = useState(todayISO());
  const last = transactions.find((t) => t.kind === "expense");
  const [method, setMethod] = useState<string>(last?.payment_method === "credito" && cards.length ? "credito" : last?.payment_method ?? "pix");
  const [cardId, setCardId] = useState<string>(last?.card_id ?? cards[0]?.id ?? "");
  const [full, setFull] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // Categorias mais usadas primeiro
  const ordered = useMemo(() => {
    const count = new Map<string, number>();
    transactions.forEach((t) => t.category_id && count.set(t.category_id, (count.get(t.category_id) ?? 0) + 1));
    return [...categories].sort((a, b) => (count.get(b.id) ?? 0) - (count.get(a.id) ?? 0)).slice(0, 12);
  }, [categories, transactions]);
  const cat = categories.find((c) => c.id === catId);

  const reset = () => { setAmount(""); setCatId(null); setDesc(""); setDate(todayISO()); setFull(false); setError(null); };
  const close = () => { reset(); onClose(); };

  const save = () => {
    const value = parseBRNumber(amount);
    if (!value || value <= 0) { setError("Digite o valor."); return; }
    if (kind === "expense" && !catId) { setError("Escolha a categoria."); return; }
    start(async () => {
      const r = await saveRecord("transactions", {
        kind, description: desc.trim() || (kind === "income" ? "Receita extra" : cat?.name ?? "Despesa"),
        amount: value, category_id: kind === "expense" ? catId : null, occurred_on: date,
        payment_method: kind === "income" ? "pix" : method, card_id: method === "credito" ? cardId : null,
        installments: 1, is_essential: cat?.essential_default ?? false, recurrence: "nenhuma", notes: "",
      });
      if (r.ok) close(); else setError(r.error + (r.fieldErrors ? " " + Object.values(r.fieldErrors).join(" ") : ""));
    });
  };

  return (
    <Sheet open={open} onClose={close} title={full ? "Novo lançamento" : kind === "expense" ? "Nova despesa" : "Nova receita"}>
      {full ? (
        <EntityForm table="transactions" fields={transactionFields(categories, cards)}
          initial={{ kind, occurred_on: date, payment_method: method, card_id: cardId, recurrence: "nenhuma", installments: 1, amount: parseBRNumber(amount) || "", category_id: catId ?? "", description: desc }}
          onDone={close} />
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-1 rounded-full bg-surface-2 p-1 text-sm font-medium">
            {(["expense", "income"] as const).map((k) => (
              <button key={k} onClick={() => setKind(k)} className={cx("rounded-full py-2 transition", kind === k ? "bg-surface shadow-sm" : "text-muted")}>
                {k === "expense" ? "Despesa" : "Receita extra"}
              </button>
            ))}
          </div>

          <label className="block text-center">
            <span className="sr-only">Valor</span>
            <span className="flex items-baseline justify-center gap-2">
              <span className="text-2xl font-medium text-faint">R$</span>
              <input autoFocus inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00"
                className="num w-48 bg-transparent text-center text-5xl font-semibold tracking-tight outline-none focus-visible:outline-none placeholder:text-line" />
            </span>
          </label>

          {kind === "expense" && (
            <div>
              <div className="mb-2 text-[13px] font-medium text-muted">Categoria</div>
              <div className="grid grid-cols-4 gap-2">
                {ordered.map((c) => (
                  <button key={c.id} onClick={() => setCatId(c.id)}
                    className={cx("flex flex-col items-center gap-1.5 rounded-2xl p-2 text-[11px] leading-tight transition", catId === c.id ? "bg-accent-soft text-fg ring-2 ring-accent" : "hover:bg-surface-2 text-muted")}>
                    <CatIcon cat={c} size={36} />
                    <span className="line-clamp-2 text-center">{c.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <input className="input col-span-2" placeholder={kind === "income" ? "Descrição (ex.: retroativo)" : "Descrição (opcional)"} value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={120} aria-label="Descrição" />
            <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Data" />
            {kind === "expense" && (
              <select className="input" value={method} onChange={(e) => setMethod(e.target.value)} aria-label="Forma de pagamento">
                <option value="pix">Pix</option><option value="debito">Débito</option>
                {cards.length > 0 && <option value="credito">Crédito</option>}
                <option value="dinheiro">Dinheiro</option><option value="boleto">Boleto</option>
              </select>
            )}
            {kind === "expense" && method === "credito" && cards.length > 1 && (
              <select className="input col-span-2" value={cardId} onChange={(e) => setCardId(e.target.value)} aria-label="Cartão">
                {cards.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}
          </div>

          {error && <p className="text-sm text-neg">{error}</p>}
          <button onClick={save} disabled={pending} className={cx(buttonClass("primary"), "w-full rounded-full py-3 text-base")}>{pending ? "Salvando…" : "Salvar"}</button>
          <button onClick={() => setFull(true)} className="w-full text-center text-[13px] font-medium text-accent">Parcelado, recorrente ou mais detalhes</button>
        </div>
      )}
    </Sheet>
  );
}
