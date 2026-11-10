import { useEffect, useState, useTransition } from "react";
import { CircleCheck } from "lucide-react";
import { todayISO } from "@/lib/finance/dates";
import { brl, dateBR } from "@/lib/finance/format";
import { parseBRNumber } from "@/components/forms";
import { buttonClass, cx } from "@/components/ui";
import type { CycleBill } from "../cycle";
import { addSaving, payBill, undoPayment } from "../bills-actions";
import { Sheet } from "./common";

const fmt = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function BillSheet({ bill, cycleKey, onClose }: { bill: CycleBill | null; cycleKey: string; onClose: () => void }) {
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  useEffect(() => { if (bill) { setAmount(fmt(bill.amount)); setDate(todayISO()); setError(null); } }, [bill]);
  if (!bill) return null;

  const pay = () => start(async () => {
    const v = parseBRNumber(amount);
    if (!v || v <= 0) { setError("Informe o valor pago."); return; }
    try { await payBill(bill, cycleKey, v, date); onClose(); } catch (e) { setError((e as Error).message); }
  });
  const undo = () => start(async () => { if (bill.paid) { await undoPayment(bill.paid.id); onClose(); } });

  return (
    <Sheet open onClose={onClose} title={bill.label}>
      {bill.paid ? (
        <div className="space-y-5">
          <div className="flex items-center gap-3 rounded-2xl bg-accent-soft p-4">
            <CircleCheck size={24} className="text-pos" />
            <div>
              <div className="text-[15px] font-semibold">Paga em {dateBR(bill.paid.paid_on)}</div>
              <div className="num text-[14px] text-muted">{brl(bill.paid.amount)}</div>
            </div>
          </div>
          <button onClick={undo} disabled={pending} className={cx(buttonClass("outline"), "w-full rounded-full py-3")}>{pending ? "Desfazendo…" : "Desfazer pagamento"}</button>
        </div>
      ) : (
        <div className="space-y-5">
          <p className="text-[14px] text-muted">{bill.date ? `Vence ${dateBR(bill.date)}` : "Sem dia de vencimento definido"} · {bill.detail}</p>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-[13px] font-medium text-muted">Valor pago</span>
              <span className="relative block">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-faint">R$</span>
                <input className="input num pl-9" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </span>
            </label>
            <label className="block">
              <span className="mb-1 block text-[13px] font-medium text-muted">Data do pagamento</span>
              <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
          </div>
          {bill.kind === "cartao" && <p className="text-[12px] text-faint">Baixa a fatura do cartão. Não conta como gasto novo: as compras já foram contadas quando você as fez.</p>}
          {bill.kind === "parcela" && <p className="text-[12px] text-faint">Diminui uma parcela e o saldo devedor.</p>}
          {error && <p className="text-sm text-neg">{error}</p>}
          <button onClick={pay} disabled={pending} className={cx(buttonClass("primary"), "w-full rounded-full py-3 text-base")}>{pending ? "Salvando…" : "Marcar como paga"}</button>
        </div>
      )}
    </Sheet>
  );
}

export function SavingSheet({ goal, suggested, onClose }: { goal: { id: string; name: string } | null; suggested: number; onClose: () => void }) {
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  useEffect(() => { if (goal) { setAmount(suggested > 0 ? fmt(suggested) : ""); setDate(todayISO()); setError(null); } }, [goal, suggested]);
  if (!goal) return null;
  const save = () => start(async () => {
    const v = parseBRNumber(amount);
    if (!v || v <= 0) { setError("Informe quanto você guardou."); return; }
    await addSaving(goal.id, v, date);
    onClose();
  });
  return (
    <Sheet open onClose={onClose} title={`Guardar em ${goal.name}`}>
      <div className="space-y-5">
        <label className="block text-center">
          <span className="sr-only">Valor</span>
          <span className="flex items-baseline justify-center gap-2">
            <span className="text-2xl font-medium text-faint">R$</span>
            <input autoFocus inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00"
              className="num w-48 bg-transparent text-center text-5xl font-semibold tracking-tight outline-none focus-visible:outline-none placeholder:text-line" />
          </span>
        </label>
        {suggested > 0 && <p className="text-center text-[13px] text-muted">Plano para este salário: {brl(suggested)}</p>}
        <label className="block">
          <span className="mb-1 block text-[13px] font-medium text-muted">Data</span>
          <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <p className="text-[12px] text-faint">O valor sai como aporte (não é gasto) e soma no saldo da meta{goal.name.toLowerCase().includes("reserva") ? " e da sua reserva de emergência" : ""}.</p>
        {error && <p className="text-sm text-neg">{error}</p>}
        <button onClick={save} disabled={pending} className={cx(buttonClass("primary"), "w-full rounded-full py-3 text-base")}>{pending ? "Salvando…" : "Guardar"}</button>
      </div>
    </Sheet>
  );
}
