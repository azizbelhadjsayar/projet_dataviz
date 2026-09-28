"use client";

import type { Unit } from "@/lib/data/schema";
import { fmtValue } from "@/lib/format";

export interface Series {
  key: string;
  label: string;
  color: string;
}

export const AXIS_TICK = { fill: "var(--muted)", fontSize: 12 };

interface TooltipItem {
  dataKey?: string | number | ((obj: unknown) => unknown);
  value?: unknown;
  color?: string;
  payload?: Record<string, unknown>;
}

/** Infobulle : la valeur d'abord (forte), la série ensuite, avec une courte clé de ligne. */
export function ChartTooltip({
  active, payload, label, series, unit, title,
}: {
  active?: boolean;
  payload?: readonly TooltipItem[];
  label?: string | number;
  series: Series[];
  unit: Unit;
  title?: (label: string | number | undefined, payload: Record<string, unknown> | undefined) => string;
}) {
  if (!active || !payload?.length) return null;
  const heading = title ? title(label, payload[0]?.payload) : String(label ?? "");
  return (
    <div className="pointer-events-none min-w-40 rounded-md border border-line bg-surface px-3 py-2 text-sm shadow-lg">
      {heading && <p className="mb-1 text-xs font-medium text-ink-2">{heading}</p>}
      {series.map((s) => {
        const item = payload.find((p) => p.dataKey === s.key);
        if (!item) return null;
        return (
          <div key={s.key} className="flex items-center gap-2 py-0.5">
            <span className="inline-block h-0.5 w-3 rounded" style={{ background: s.color }} aria-hidden />
            <span className="tabular font-semibold text-ink">{fmtValue(item.value as number | null, unit)}</span>
            <span className="text-ink-2">{s.label}</span>
          </div>
        );
      })}
    </div>
  );
}

export function Legend({ series, shape = "rect" }: { series: Series[]; shape?: "rect" | "line" }) {
  if (series.length < 2) return null;
  return (
    <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
      {series.map((s) => (
        <li key={s.key} className="flex items-center gap-1.5">
          <span
            aria-hidden
            className={shape === "rect" ? "inline-block h-2.5 w-2.5 rounded-sm" : "inline-block h-0.5 w-3.5 rounded"}
            style={{ background: s.color }}
          />
          {s.label}
        </li>
      ))}
    </ul>
  );
}

export const truncate = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/**
 * Axe X de catégories sans chevauchement : libellés droits s'ils tiennent, sinon inclinés (-35°)
 * et raccourcis ; la hauteur de l'axe s'adapte (le libellé complet reste dans l'infobulle).
 */
export function categoryAxis(labels: string[]) {
  const longest = Math.max(0, ...labels.map((l) => l.length));
  const angled = labels.length > 12 || (labels.length > 5 && longest > 9) || (labels.length > 3 && longest > 16);
  const maxChars = angled ? 22 : 18;
  const height = angled ? Math.min(120, 18 + Math.min(longest, maxChars) * 5.2) : 30;
  const tick = (props: { x?: number | string; y?: number | string; payload?: { value?: unknown } }) => {
    const x = Number(props.x), y = Number(props.y);
    const text = truncate(String(props.payload?.value ?? ""), maxChars);
    return angled ? (
      <text x={x} y={y} dy={8} textAnchor="end" transform={`rotate(-35, ${x}, ${y})`} fill="var(--muted)" fontSize={11}>{text}</text>
    ) : (
      <text x={x} y={y} dy={14} textAnchor="middle" fill="var(--muted)" fontSize={12}>{text}</text>
    );
  };
  return { angled, height, tick, extra: angled ? height - 30 : 0 };
}
