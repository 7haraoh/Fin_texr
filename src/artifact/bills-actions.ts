// Ações sobre contas do ciclo e aportes em metas.
import { getState, putRow, deleteRow, uid, type BillPayment } from "./store";
import { DEFAULT_CATEGORIES } from "./defaults";
import type { CycleBill } from "./cycle";
import { num, round2 } from "@/lib/finance/types";

const INVEST_CAT = DEFAULT_CATEGORIES.find((c) => c.group_name === "Financeiro" && c.name === "Investimentos")!.id;
const now = () => new Date().toISOString();
const row = (name: Parameters<typeof deleteRow>[0], id: string) => getState().rows[name].find((r) => r.id === id);

export async function payBill(bill: CycleBill, cycleKey: string, amount: number, paidOn: string) {
  const id = `${bill.id}__${cycleKey}`;
  const rec: Record<string, unknown> = { bill_key: bill.id, cycle_key: cycleKey, amount: round2(amount), paid_on: paidOn, kind: bill.kind, label: bill.label, created_at: now() };

  if (bill.ref.cardId) {
    const txId = uid();
    await putRow("transactions", txId, {
      kind: "card_payment", description: `Pagamento — ${bill.label}`, amount: round2(amount), category_id: null, occurred_on: paidOn,
      payment_method: "pix", card_id: bill.ref.cardId, installments: 1, is_essential: true, recurrence: "nenhuma", notes: null, created_at: now(),
    });
    rec.ref_tx = txId;
  } else if (bill.ref.debtId) {
    const d = row("debts", bill.ref.debtId);
    if (d) {
      rec.prev_remaining = d.remaining_installments ?? null;
      rec.prev_outstanding = d.outstanding_balance ?? 0;
      await putRow("debts", d.id, {
        ...d,
        remaining_installments: d.remaining_installments === null || d.remaining_installments === undefined ? null : Math.max(0, Number(d.remaining_installments) - 1),
        outstanding_balance: round2(Math.max(0, num(d.outstanding_balance as number) - amount)),
        updated_at: now(),
      });
    }
  } else if (bill.ref.templateTxId) {
    const t = row("transactions", bill.ref.templateTxId);
    if (t) {
      const txId = uid();
      await putRow("transactions", txId, { ...t, id: txId, amount: round2(amount), occurred_on: paidOn, created_at: now(), updated_at: now() });
      rec.ref_tx = txId;
    }
  }
  await putRow("bill_payments", id, rec);
}

export async function undoPayment(paymentId: string) {
  const p = row("bill_payments", paymentId) as (BillPayment & Record<string, unknown>) | undefined;
  if (!p) return;
  if (p.ref_tx) await deleteRow("transactions", String(p.ref_tx));
  if (String(p.bill_key).startsWith("debt-")) {
    const d = row("debts", String(p.bill_key).slice(5));
    if (d) await putRow("debts", d.id, { ...d, remaining_installments: (p.prev_remaining as number | null) ?? d.remaining_installments, outstanding_balance: (p.prev_outstanding as number) ?? d.outstanding_balance, updated_at: now() });
  }
  await deleteRow("bill_payments", paymentId);
}

/** Aporte numa meta: registra a saída como investimento (não é consumo), soma na meta e, se for a reserva, no saldo da reserva. */
export async function addSaving(goalId: string, amount: number, date: string) {
  const g = row("goals", goalId);
  if (!g || amount <= 0) return;
  await putRow("transactions", uid(), {
    kind: "expense", description: `Aporte — ${g.name}`, amount: round2(amount), category_id: INVEST_CAT, occurred_on: date,
    payment_method: "pix", card_id: null, installments: 1, is_essential: false, recurrence: "nenhuma", notes: `goal:${goalId}`, created_at: now(),
  });
  await putRow("goals", g.id, { ...g, current_amount: round2(num(g.current_amount as number) + amount), updated_at: now() });
  if (g.type === "reserva") {
    const reserveAsset = getState().rows.assets.find((x) => x.is_emergency_reserve);
    if (reserveAsset) await putRow("assets", reserveAsset.id, { ...reserveAsset, value: round2(num(reserveAsset.value as number) + amount), updated_at: now() });
    else await putRow("assets", uid(), { name: "Reserva de emergência", type: "investimento", value: round2(amount), institution: null, is_emergency_reserve: true, notes: "Criada pelos aportes da meta de reserva.", created_at: now() });
  }
}
