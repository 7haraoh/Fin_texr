"use client";

// Gráficos: paleta categórica validada (5 cores fixas + cinza reservado para "Outros"),
// um único eixo por gráfico, marcas finas, tooltip em R$ e legenda para ≥ 2 séries.

import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart,
  ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { brl, brlShort } from "@/lib/finance/format";

export const SERIES = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];
export const OTHER = "var(--chart-6)";

const axis = { stroke: "var(--faint)", fontSize: 11, tickLine: false, axisLine: false } as const;
const grid = <CartesianGrid stroke="var(--line)" strokeDasharray="0" vertical={false} />;

function TooltipBox({ active, payload, label }: { active?: boolean; payload?: { name?: string; value?: number; color?: string; payload?: { fill?: string } }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-lg">
      {label && <div className="mb-1 font-medium text-fg">{label}</div>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 text-muted">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color ?? p.payload?.fill }} />
          <span>{p.name}</span>
          <span className="num ml-auto pl-3 font-medium text-fg">{brl(Number(p.value ?? 0))}</span>
        </div>
      ))}
    </div>
  );
}

const legend = <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: "var(--muted)", paddingTop: 8 }} />;

export function GroupedBars({ data, series, height = 240 }: {
  data: Record<string, string | number>[]; series: { key: string; name: string }[]; height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} barGap={2} barCategoryGap="28%">
        {grid}
        <XAxis dataKey="label" {...axis} />
        <YAxis {...axis} tickFormatter={(v) => brlShort(v)} width={64} />
        <Tooltip content={<TooltipBox />} cursor={{ fill: "var(--surface-2)" }} />
        {series.length > 1 && legend}
        {series.map((s, i) => <Bar key={s.key} dataKey={s.key} name={s.name} fill={SERIES[i]} radius={[4, 4, 0, 0]} maxBarSize={28} />)}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function SignedBars({ data, dataKey, name, height = 200 }: { data: Record<string, string | number>[]; dataKey: string; name: string; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} barCategoryGap="35%">
        {grid}
        <XAxis dataKey="label" {...axis} />
        <YAxis {...axis} tickFormatter={(v) => brlShort(v)} width={64} />
        <ReferenceLine y={0} stroke="var(--faint)" />
        <Tooltip content={<TooltipBox />} cursor={{ fill: "var(--surface-2)" }} />
        <Bar dataKey={dataKey} name={name} radius={[4, 4, 4, 4]} maxBarSize={28}>
          {data.map((d, i) => <Cell key={i} fill={Number(d[dataKey]) >= 0 ? "var(--pos)" : "var(--neg)"} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function Lines({ data, series, height = 240, area, dashedFrom }: {
  data: Record<string, string | number | null>[]; series: { key: string; name: string; color?: string }[];
  height?: number; area?: boolean; dashedFrom?: string;
}) {
  if (area && series.length === 1) {
    const s = series[0];
    return (
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id={`g-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color ?? SERIES[0]} stopOpacity={0.25} />
              <stop offset="100%" stopColor={s.color ?? SERIES[0]} stopOpacity={0} />
            </linearGradient>
          </defs>
          {grid}
          <XAxis dataKey="label" {...axis} minTickGap={16} />
          <YAxis {...axis} tickFormatter={(v) => brlShort(v)} width={64} />
          <Tooltip content={<TooltipBox />} cursor={{ stroke: "var(--faint)" }} />
          <Area type="monotone" dataKey={s.key} name={s.name} stroke={s.color ?? SERIES[0]} strokeWidth={2} fill={`url(#g-${s.key})`} activeDot={{ r: 4 }} />
        </AreaChart>
      </ResponsiveContainer>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data}>
        {grid}
        <XAxis dataKey="label" {...axis} minTickGap={16} />
        <YAxis {...axis} tickFormatter={(v) => brlShort(v)} width={64} />
        <Tooltip content={<TooltipBox />} cursor={{ stroke: "var(--faint)" }} />
        {series.length > 1 && legend}
        {dashedFrom && <ReferenceLine x={dashedFrom} stroke="var(--faint)" strokeDasharray="4 4" label={{ value: "hoje", fill: "var(--faint)", fontSize: 11, position: "insideTopRight" }} />}
        {series.map((s, i) => (
          <Line key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={s.color ?? SERIES[i]} strokeWidth={2} dot={false} activeDot={{ r: 4 }} connectNulls />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Rosca com até 5 fatias nomeadas + "Outros". Legenda lateral com valores. */
export function Donut({ items, height = 220 }: { items: { name: string; value: number }[]; height?: number }) {
  const sorted = [...items].filter((i) => i.value > 0).sort((a, b) => b.value - a.value);
  const top = sorted.slice(0, 5);
  const rest = sorted.slice(5).reduce((s, i) => s + i.value, 0);
  const data = rest > 0 ? [...top, { name: "Outros", value: rest }] : top;
  const total = data.reduce((s, i) => s + i.value, 0);
  const color = (i: number, name: string) => (name === "Outros" ? OTHER : SERIES[i]);
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="h-[180px] w-[180px] shrink-0" style={{ height: Math.min(height, 180) }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip content={<TooltipBox />} />
            <Pie data={data} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="100%" paddingAngle={1.5} stroke="var(--surface)" strokeWidth={2}>
              {data.map((d, i) => <Cell key={d.name} fill={color(i, d.name)} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="w-full space-y-1.5 text-xs">
        {data.map((d, i) => (
          <li key={d.name} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: color(i, d.name) }} />
            <span className="truncate text-muted">{d.name}</span>
            <span className="num ml-auto font-medium">{brl(d.value)}</span>
            <span className="num w-11 text-right text-faint">{total > 0 ? Math.round((d.value / total) * 100) : 0}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
