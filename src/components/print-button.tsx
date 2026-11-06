"use client";
import { FileText } from "lucide-react";
import { buttonClass } from "./ui";
export function PrintButton() {
  return <button onClick={() => window.print()} className={`${buttonClass("primary", "sm")} no-print`}><FileText size={14} /> Salvar PDF / imprimir</button>;
}
