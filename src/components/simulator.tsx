"use client";

import { useState, useTransition } from "react";
import { simulatePurchase } from "@/app/actions";
import { parseBRNumber } from "./forms";
import { Badge, Card, buttonClass, cx } from "./ui";
import { brl, pct } from "@/lib/finance/format";
import type { PurchaseEvaluation, CashVsInstallments } from "@/lib/finance/purchase";

type Result = { evaluation: PurchaseEvaluation; comparison: CashVsInstallments };

const VERDICT_TONE = { confortavel: "pos", planejamento: "info", compromete_metas: "warn", nao_recomendada: "neg" } as const;

export function Simulator() {
  const [f, setF] = useState({ item: "", price: "", method: "avista", installments: "10", interest: "0", discount: "0", need: "desejo", yield: "0,85" });
  const [res, setRes] = useState<Result | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((p) => ({ ...p, [k]: e.target.value }));

  const run = (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    start(async () => {
      const r = await simulatePurchase({
        item: f.item || "Compra", price: parseBRNumber(f.price), method: f.method, installments: f.installments,
        monthlyInterestPct: parseBRNumber(f.interest) || 0, cashDiscountPct: parseBRNumber(f.discount) || 0,
        need: f.need, yieldMonthlyPct: parseBRNumber(f.yield) || 0,
      });
      if (r.ok) setRes({ evaluation: r.evaluation, comparison: r.comparison }); else setErr(r.error);
    });
  };

  const ev = res?.evaluation;
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <Card title="Dados da compra">
        <form onSubmit={run} className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><label className="mb-1 block text-xs font-medium text-muted">Produto ou serviço</label><input className="input" value={f.item} onChange={set("item")} placeholder="Ex.: Celular novo" maxLength={120} /></div>
          <div><label className="mb-1 block text-xs font-medium text-muted">Valor (preço cheio)</label><input className="input num" inputMode="decimal" required value={f.price} onChange={set("price")} placeholder="3.000,00" /></div>
          <div><label className="mb-1 block text-xs font-medium text-muted">Finalidade</label>
            <select className="input" value={f.need} onChange={set("need")}><option value="necessidade">Necessidade</option><option value="melhoria">Melhoria / substituição</option><option value="desejo">Desejo</option></select></div>
          <div><label className="mb-1 block text-xs font-medium text-muted">Forma de pagamento</label>
            <select className="input" value={f.method} onChange={set("method")}><option value="avista">À vista</option><option value="credito_parcelado">Cartão parcelado</option><option value="financiado">Financiamento / crediário</option></select></div>
          {f.method !== "avista" && <div><label className="mb-1 block text-xs font-medium text-muted">Parcelas</label><input className="input" type="number" min={2} max={420} value={f.installments} onChange={set("installments")} /></div>}
          {f.method !== "avista" && <div><label className="mb-1 block text-xs font-medium text-muted">Juros (% ao mês)</label><input className="input num" inputMode="decimal" value={f.interest} onChange={set("interest")} /></div>}
          <div><label className="mb-1 block text-xs font-medium text-muted">Desconto à vista (%)</label><input className="input num" inputMode="decimal" value={f.discount} onChange={set("discount")} /></div>
          <div><label className="mb-1 block text-xs font-medium text-muted">Rendimento da aplicação (% a.m.)</label><input className="input num" inputMode="decimal" value={f.yield} onChange={set("yield")} /><p className="mt-1 text-[11px] text-faint">Para o custo de oportunidade</p></div>
          {err && <p className="text-sm text-neg sm:col-span-2">{err}</p>}
          <div className="sm:col-span-2"><button disabled={pending} className={cx(buttonClass("primary"), "w-full")}>{pending ? "Analisando…" : "Avaliar compra"}</button></div>
        </form>
      </Card>

      <div className="space-y-6">
        {!ev ? (
          <Card><p className="text-sm text-muted">Informe a compra para ver a avaliação. A análise considera saldo disponível, faturas e parcelas futuras, despesas previstas, metas, reserva de emergência e o impacto no orçamento mensal.</p></Card>
        ) : (
          <>
            <Card>
              <Badge tone={VERDICT_TONE[ev.verdict]}>Avaliação</Badge>
              <h2 className="mt-2 text-xl font-semibold">{ev.label}</h2>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <div><div className="text-xs text-faint">{ev.metrics.installment ? "Parcela" : "Pagamento"}</div><div className="num font-medium">{brl(ev.metrics.installment || ev.metrics.upfront)}</div></div>
                <div><div className="text-xs text-faint">Custo total</div><div className="num font-medium">{brl(ev.metrics.totalCost)}</div></div>
                <div><div className="text-xs text-faint">Economia mensal após</div><div className={cx("num font-medium", ev.metrics.savingsAfter < 0 && "text-neg")}>{brl(ev.metrics.savingsAfter)}</div></div>
                <div><div className="text-xs text-faint">{ev.metrics.installment ? "Comprometimento" : "Caixa após"}</div><div className="num font-medium">{ev.metrics.installment ? pct(ev.metrics.newCommitmentRatio) : brl(ev.metrics.cashAfter)}</div></div>
              </div>
              <h3 className="mt-5 text-sm font-semibold">Motivos</h3>
              <ul className="mt-1.5 list-disc space-y-1 pl-4 text-sm text-muted">{ev.reasons.map((r, i) => <li key={i}>{r}</li>)}</ul>
              {ev.alternatives.length > 0 && <>
                <h3 className="mt-4 text-sm font-semibold">Alternativas</h3>
                <ul className="mt-1.5 list-disc space-y-1 pl-4 text-sm text-muted">{ev.alternatives.map((r, i) => <li key={i}>{r}</li>)}</ul>
              </>}
            </Card>
            {res && (
              <Card title="À vista × parcelado" subtitle="Considera juros, desconto e custo de oportunidade (estimativa)">
                <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                  <div><div className="text-xs text-faint">À vista</div><div className="num font-medium">{brl(res.comparison.cashPrice)}</div></div>
                  <div><div className="text-xs text-faint">Parcela</div><div className="num font-medium">{brl(res.comparison.installment)}</div></div>
                  <div><div className="text-xs text-faint">Total parcelado</div><div className="num font-medium">{brl(res.comparison.totalInstallments)}</div></div>
                  <div><div className="text-xs text-faint">Valor presente</div><div className="num font-medium">{brl(res.comparison.presentValueInstallments)}</div></div>
                </div>
                <p className="mt-3 text-sm text-muted">{res.comparison.explanation}</p>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
