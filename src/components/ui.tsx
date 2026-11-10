import Link from "next/link";
import { brl } from "@/lib/finance/format";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="page-header mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, subtitle, action, children, className }: {
  title?: React.ReactNode; subtitle?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  return (
    <section className={cx("card p-5", className)}>
      {(title || action) && (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            {title && <h2 className="text-sm font-semibold">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, hint, tone, estimate }: {
  label: string; value: React.ReactNode; hint?: React.ReactNode; tone?: "pos" | "neg" | "warn"; estimate?: boolean;
}) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted">
        {label}
        {estimate && <span title="Valor estimado a partir dos dados cadastrados" className="rounded bg-surface-2 px-1 text-[10px] uppercase tracking-wide text-faint">est.</span>}
      </div>
      <div className={cx("num mt-1.5 text-xl font-semibold tracking-tight",
        tone === "pos" && "text-pos", tone === "neg" && "text-neg", tone === "warn" && "text-warn")}>{value}</div>
      {hint && <div className="mt-1 text-xs text-faint">{hint}</div>}
    </div>
  );
}

export function Money({ value, signed, className }: { value: number; signed?: boolean; className?: string }) {
  const tone = signed ? (value > 0 ? "text-pos" : value < 0 ? "text-neg" : "") : "";
  return <span className={cx("num", tone, className)}>{signed && value > 0 ? "+" : ""}{brl(value)}</span>;
}

const badgeTones = {
  neutral: "bg-surface-2 text-muted",
  pos: "bg-accent-soft text-pos",
  neg: "bg-[color-mix(in_srgb,var(--neg)_14%,transparent)] text-neg",
  warn: "bg-[color-mix(in_srgb,var(--warn)_16%,transparent)] text-warn",
  info: "bg-[color-mix(in_srgb,var(--info)_14%,transparent)] text-info",
};

export function Badge({ tone = "neutral", children }: { tone?: keyof typeof badgeTones; children: React.ReactNode }) {
  return <span className={cx("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium", badgeTones[tone])}>{children}</span>;
}

export function Progress({ value, tone }: { value: number; tone?: "pos" | "neg" | "warn" | "auto" }) {
  const v = Math.max(0, Math.min(1, value));
  const t = tone === "auto" || !tone ? (value > 1 ? "neg" : value > 0.85 ? "warn" : "pos") : tone;
  const color = t === "neg" ? "bg-neg" : t === "warn" ? "bg-warn" : "bg-accent";
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100}>
      <div className={cx("h-full rounded-full transition-all", color)} style={{ width: `${v * 100}%` }} />
    </div>
  );
}

export function EmptyState({ title, text, href, cta }: { title: string; text?: string; href?: string; cta?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line px-6 py-10 text-center">
      <p className="text-sm font-medium">{title}</p>
      {text && <p className="mt-1 max-w-sm text-xs text-muted">{text}</p>}
      {href && cta && <Link href={href} className="mt-4 text-sm font-medium text-accent hover:underline">{cta} →</Link>}
    </div>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warn" | "neg"; children: React.ReactNode }) {
  const map = { info: "border-info/30 text-fg", warn: "border-warn/40", neg: "border-neg/40" };
  const bar = { info: "bg-info", warn: "bg-warn", neg: "bg-neg" };
  return (
    <div className={cx("relative overflow-hidden rounded-xl border bg-surface px-4 py-3 pl-5 text-sm", map[tone])}>
      <span className={cx("absolute inset-y-0 left-0 w-1", bar[tone])} />
      {children}
    </div>
  );
}

export const buttonClass = (variant: "primary" | "ghost" | "danger" | "outline" = "primary", size: "sm" | "md" = "md") => cx(
  "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
  size === "sm" ? "px-2.5 py-1.5 text-xs" : "px-3.5 py-2 text-sm",
  variant === "primary" && "bg-accent text-accent-fg hover:brightness-110",
  variant === "outline" && "border border-line bg-surface hover:bg-surface-2",
  variant === "ghost" && "text-muted hover:bg-surface-2 hover:text-fg",
  variant === "danger" && "bg-neg text-white hover:brightness-110",
);
