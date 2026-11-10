import {
  ArrowDownLeft, Car, CreditCard, Ellipsis, Gamepad2, House, Landmark, Repeat, Shirt, UtensilsCrossed,
  ChevronLeft, ChevronRight, X,
} from "lucide-react";
import { useEffect } from "react";
import type { Category, Transaction } from "@/lib/finance/types";
import { brl } from "@/lib/finance/format";
import { cx } from "@/components/ui";
import { navigate } from "../router";

const GROUP_STYLE: Record<string, { icon: typeof House; hue: string }> = {
  Moradia: { icon: House, hue: "var(--c-blue)" },
  "Alimentação": { icon: UtensilsCrossed, hue: "var(--c-amber)" },
  Transporte: { icon: Car, hue: "var(--c-teal)" },
  Pessoal: { icon: Shirt, hue: "var(--c-violet)" },
  Lazer: { icon: Gamepad2, hue: "var(--c-rose)" },
  Financeiro: { icon: Landmark, hue: "var(--c-slate)" },
  Assinaturas: { icon: Repeat, hue: "var(--c-violet)" },
};

export function categoryStyle(cat?: Category | null, kind?: Transaction["kind"]) {
  if (kind === "income") return { icon: ArrowDownLeft, hue: "var(--pos)" };
  if (kind === "card_payment") return { icon: CreditCard, hue: "var(--c-slate)" };
  return GROUP_STYLE[cat?.group_name ?? ""] ?? { icon: Ellipsis, hue: "var(--c-slate)" };
}

export function CatIcon({ cat, kind, size = 40 }: { cat?: Category | null; kind?: Transaction["kind"]; size?: number }) {
  const { icon: Icon, hue } = categoryStyle(cat, kind);
  return (
    <span className="inline-flex shrink-0 items-center justify-center rounded-full"
      style={{ width: size, height: size, background: `color-mix(in srgb, ${hue} 16%, transparent)`, color: hue }}>
      <Icon size={Math.round(size * 0.45)} strokeWidth={2} />
    </span>
  );
}

export function Amount({ value, className, signed }: { value: number; className?: string; signed?: boolean }) {
  return <span className={cx("num", signed && value > 0 && "text-pos", className)}>{signed && value > 0 ? "+" : ""}{brl(value)}</span>;
}

export function Section({ title, action, children, className }: { title: string; action?: { label: string; href: string }; children: React.ReactNode; className?: string }) {
  return (
    <section className={cx("space-y-3", className)}>
      <div className="flex items-baseline justify-between px-1">
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-muted">{title}</h2>
        {action && <button onClick={() => navigate(action.href)} className="text-[13px] font-medium text-accent">{action.label}</button>}
      </div>
      {children}
    </section>
  );
}

export function Panel({ children, className, onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) {
  const Tag = onClick ? "button" : "div";
  return <Tag onClick={onClick} className={cx("panel block w-full text-left", className)}>{children}</Tag>;
}

export function Row({ left, title, subtitle, right, onClick }: { left?: React.ReactNode; title: React.ReactNode; subtitle?: React.ReactNode; right?: React.ReactNode; onClick?: () => void }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag onClick={onClick} className={cx("flex w-full items-center gap-3 px-4 py-3 text-left", onClick && "active:bg-surface-2 hover:bg-surface-2/60")}>
      {left}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-medium">{title}</span>
        {subtitle && <span className="block truncate text-[13px] text-muted">{subtitle}</span>}
      </span>
      {right}
    </Tag>
  );
}

export function MonthSwitcher({ label, onPrev, onNext }: { label: string; onPrev: () => void; onNext: () => void }) {
  return (
    <div className="flex items-center justify-center gap-2">
      <button onClick={onPrev} className="rounded-full p-2 text-muted hover:bg-surface-2" aria-label="Mês anterior"><ChevronLeft size={18} /></button>
      <span className="min-w-36 text-center text-[15px] font-semibold first-letter:uppercase">{label}</span>
      <button onClick={onNext} className="rounded-full p-2 text-muted hover:bg-surface-2" aria-label="Próximo mês"><ChevronRight size={18} /></button>
    </div>
  );
}

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 sm:items-center" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => e.stopPropagation()}
        className="sheet max-h-[92dvh] w-full overflow-y-auto bg-surface sm:max-w-md sm:rounded-[24px]">
        <div className="sticky top-0 z-10 flex items-center justify-between bg-surface px-5 pb-2 pt-4">
          <span className="mx-auto h-1 w-10 rounded-full bg-line sm:hidden" aria-hidden />
        </div>
        <div className="flex items-center justify-between px-5 pb-3">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded-full p-2 text-muted hover:bg-surface-2" aria-label="Fechar"><X size={18} /></button>
        </div>
        <div className="px-5 pb-6">{children}</div>
      </div>
    </div>
  );
}

export function BackHeader({ title, back = "/mais", backLabel = "Mais" }: { title: string; back?: string; backLabel?: string }) {
  return (
    <div className="mb-4 flex items-center gap-1">
      <button onClick={() => navigate(back)} className="-ml-2 flex items-center gap-0.5 rounded-full px-2 py-1.5 text-[15px] font-medium text-accent">
        <ChevronLeft size={18} /> {backLabel}
      </button>
      <span className="sr-only">{title}</span>
    </div>
  );
}
