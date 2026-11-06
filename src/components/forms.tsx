"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash, X } from "lucide-react";
import { deleteRecord, saveRecord, type ActionResult } from "@/app/actions";
import { buttonClass, cx, EmptyState } from "./ui";

export type FieldType = "text" | "money" | "number" | "percent" | "date" | "select" | "checkbox" | "textarea" | "day" | "int";

export interface FieldDef {
  name: string;
  label: string;
  type: FieldType;
  options?: { value: string; label: string }[];
  required?: boolean;
  help?: string;
  placeholder?: string;
  showIf?: (v: Record<string, unknown>) => boolean;
  /** Ajusta outros campos quando este muda (ex.: categoria → essencial). */
  effect?: (value: unknown, values: Record<string, unknown>) => Record<string, unknown>;
  full?: boolean;
}

/** Aceita "1.234,56", "1234,56" ou "1234.56". */
export function parseBRNumber(input: string): number | "" {
  const s = input.trim().replace(/[R$\s]/g, "");
  if (!s) return "";
  let normalized: string;
  if (s.includes(",")) normalized = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d+\.\d{1,2}$/.test(s)) normalized = s;
  else normalized = s.replace(/\./g, "");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : "";
}

const toInput = (v: unknown, type: FieldType): string => {
  if (v === null || v === undefined) return "";
  if (type === "money" || type === "percent") {
    const n = Number(v);
    return Number.isFinite(n) ? n.toLocaleString("pt-BR", { maximumFractionDigits: 4 }) : "";
  }
  return String(v);
};

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title}
        className={cx("card max-h-[92dvh] w-full overflow-y-auto rounded-b-none p-5 sm:rounded-b-[14px]", wide ? "sm:max-w-2xl" : "sm:max-w-lg")}
        onMouseDown={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">{title}</h2>
          <button onClick={onClose} className={buttonClass("ghost", "sm")} aria-label="Fechar"><X size={16} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function FieldInput({ field, value, onChange, error }: {
  field: FieldDef; value: unknown; onChange: (v: unknown) => void; error?: string;
}) {
  const id = `f-${field.name}`;
  const common = { id, name: field.name, "aria-invalid": error ? true : undefined, className: "input" } as const;
  let control: React.ReactNode;
  switch (field.type) {
    case "select":
      control = (
        <select {...common} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} required={field.required}>
          {!field.required && <option value="">—</option>}
          {field.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      );
      break;
    case "checkbox":
      return (
        <label className={cx("flex items-start gap-2 text-sm", field.full && "sm:col-span-2")}>
          <input type="checkbox" name={field.name} checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--accent)]" />
          <span>
            {field.label}
            {field.help && <span className="block text-xs text-faint">{field.help}</span>}
          </span>
        </label>
      );
    case "textarea":
      control = <textarea {...common} rows={3} value={String(value ?? "")} placeholder={field.placeholder} onChange={(e) => onChange(e.target.value)} />;
      break;
    case "date":
      control = <input {...common} type="date" value={String(value ?? "")} required={field.required} onChange={(e) => onChange(e.target.value)} />;
      break;
    case "money":
    case "percent":
      control = (
        <div className="relative">
          {field.type === "money" && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-faint">R$</span>}
          <input {...common} className={cx("input num", field.type === "money" && "pl-9")} inputMode="decimal" placeholder={field.placeholder ?? "0,00"}
            value={String(value ?? "")} required={field.required} onChange={(e) => onChange(e.target.value)} />
          {field.type === "percent" && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-faint">%</span>}
        </div>
      );
      break;
    case "day":
    case "int":
    case "number":
      control = <input {...common} type="number" inputMode="numeric" min={field.type === "day" ? 1 : undefined} max={field.type === "day" ? 31 : undefined}
        step={field.type === "number" ? "any" : 1} value={String(value ?? "")} placeholder={field.placeholder} required={field.required} onChange={(e) => onChange(e.target.value)} />;
      break;
    default:
      control = <input {...common} type="text" value={String(value ?? "")} placeholder={field.placeholder} required={field.required} maxLength={200} onChange={(e) => onChange(e.target.value)} />;
  }
  return (
    <div className={cx(field.full && "sm:col-span-2")}>
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-muted">{field.label}{field.required && <span className="text-neg"> *</span>}</label>
      {control}
      {error ? <p className="mt-1 text-xs text-neg">{error}</p> : field.help && <p className="mt-1 text-xs text-faint">{field.help}</p>}
    </div>
  );
}

export function EntityForm({ table, fields, initial, id, onDone, submitLabel = "Salvar" }: {
  table: string; fields: FieldDef[]; initial: Record<string, unknown>; id?: string; onDone: () => void; submitLabel?: string;
}) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, unknown>>(() =>
    Object.fromEntries(fields.map((f) => [f.name, f.type === "checkbox" ? Boolean(initial[f.name]) : toInput(initial[f.name], f.type)])),
  );
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();
  const visible = fields.filter((f) => !f.showIf || f.showIf(values));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: Record<string, unknown> = {};
    for (const f of fields) {
      const v = values[f.name];
      if (f.showIf && !f.showIf(values)) { payload[f.name] = f.type === "checkbox" ? false : ""; continue; }
      payload[f.name] = (f.type === "money" || f.type === "percent") && typeof v === "string" ? parseBRNumber(v) : v;
    }
    start(async () => {
      const r = await saveRecord(table, payload, id);
      setResult(r);
      if (r.ok) { router.refresh(); onDone(); }
    });
  };

  const fieldErrors = result && !result.ok ? result.fieldErrors ?? {} : {};
  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {visible.map((f) => (
          <FieldInput key={f.name} field={f} value={values[f.name]} error={fieldErrors[f.name]}
            onChange={(v) => setValues((prev) => ({ ...prev, [f.name]: v, ...(f.effect ? f.effect(v, prev) : {}) }))} />
        ))}
      </div>
      {result && !result.ok && <p className="text-sm text-neg">{result.error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onDone} className={buttonClass("ghost")}>Cancelar</button>
        <button type="submit" disabled={pending} className={buttonClass("primary")}>{pending ? "Salvando…" : submitLabel}</button>
      </div>
    </form>
  );
}

export interface Column<T> {
  label: string;
  render: (row: T) => React.ReactNode;
  align?: "right";
  hideOnMobile?: boolean;
}

/** Lista + criação/edição/exclusão de registros de uma tabela. */
export function CrudSection<T extends { id: string }>({
  table, title, rows, fields, columns, defaults = {}, emptyTitle, emptyText, addLabel = "Adicionar", canDelete,
}: {
  table: string; title?: string; rows: T[]; fields: FieldDef[]; columns: Column<T>[];
  defaults?: Record<string, unknown>; emptyTitle: string; emptyText?: string; addLabel?: string;
  canDelete?: (row: T) => boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<T | "new" | null>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const remove = (row: T) => {
    if (!confirm("Excluir este registro? Esta ação não pode ser desfeita.")) return;
    start(async () => {
      const r = await deleteRecord(table, row.id);
      if (!r.ok) setError(r.error); else router.refresh();
    });
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        {title ? <h3 className="text-sm font-semibold">{title}</h3> : <span />}
        <button onClick={() => setEditing("new")} className={buttonClass("outline", "sm")}><Plus size={14} />{addLabel}</button>
      </div>
      {error && <p className="mb-2 text-sm text-neg">{error}</p>}
      {rows.length === 0 ? (
        <EmptyState title={emptyTitle} text={emptyText} />
      ) : (
        <div className="-mx-5 overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-faint">
                {columns.map((c, i) => (
                  <th key={i} className={cx("px-5 py-2 font-medium", c.align === "right" && "text-right", c.hideOnMobile && "hidden md:table-cell")}>{c.label}</th>
                ))}
                <th className="w-20 px-5 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-line/60 last:border-0 hover:bg-surface-2/60">
                  {columns.map((c, i) => (
                    <td key={i} className={cx("px-5 py-2.5", c.align === "right" && "text-right num", c.hideOnMobile && "hidden md:table-cell")}>{c.render(row)}</td>
                  ))}
                  <td className="px-5 py-2.5 text-right whitespace-nowrap">
                    <button onClick={() => setEditing(row)} className={buttonClass("ghost", "sm")} aria-label="Editar"><Pencil size={14} /></button>
                    {(!canDelete || canDelete(row)) && (
                      <button onClick={() => remove(row)} disabled={pending} className={buttonClass("ghost", "sm")} aria-label="Excluir"><Trash size={14} /></button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? addLabel : "Editar"} wide={fields.length > 6}>
        {editing !== null && (
          <EntityForm table={table} fields={fields}
            initial={editing === "new" ? defaults : (editing as unknown as Record<string, unknown>)}
            id={editing === "new" ? undefined : editing.id}
            onDone={() => setEditing(null)} />
        )}
      </Modal>
    </div>
  );
}
