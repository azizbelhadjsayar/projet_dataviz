"use client";

import { useMemo, useState } from "react";
import type { Unit } from "@/lib/data/schema";
import { fmtInt, fmtValue } from "@/lib/format";

export interface MapShape {
  code: string;
  name: string;
  d: string;
  box?: { x: number; y: number; w: number; h: number };
}

interface Props {
  shapes: MapShape[];
  width: number;
  height: number;
  /** Valeur par code de forme (null = pas de donnée). */
  values: Record<string, { value: number | null; formations?: number }>;
  unit: Unit;
  metricLabel: string;
  selected?: string | null;
  onSelect?: (code: string) => void;
}

const CLASSES = ["var(--seq-1)", "var(--seq-2)", "var(--seq-3)", "var(--seq-4)", "var(--seq-5)", "var(--seq-6)"];

/** Seuils par quantiles (6 classes) : lisible même avec des distributions très asymétriques. */
function quantileBreaks(vals: number[], k: number) {
  const s = [...vals].sort((a, b) => a - b);
  if (!s.length) return [];
  const breaks: number[] = [];
  for (let i = 1; i < k; i++) breaks.push(s[Math.min(s.length - 1, Math.floor((i * s.length) / k))]);
  return [...new Set(breaks)];
}

export function FranceMap({ shapes, width, height, values, unit, metricLabel, selected, onSelect }: Props) {
  const [hover, setHover] = useState<{ code: string; x: number; y: number } | null>(null);

  const { breaks, binColors, colorOf } = useMemo(() => {
    const vals = shapes.map((s) => values[s.code]?.value).filter((v): v is number => typeof v === "number");
    const breaks = quantileBreaks(vals, CLASSES.length);
    // Si des seuils se confondent (peu de valeurs distinctes), on garde des teintes étalées sur la rampe.
    const binColors = Array.from({ length: breaks.length + 1 }, (_, i) =>
      CLASSES[Math.round((i * (CLASSES.length - 1)) / Math.max(1, breaks.length))]);
    const colorOf = (v: number | null | undefined) => {
      if (v === null || v === undefined) return "var(--surface-2)";
      let i = 0;
      while (i < breaks.length && v >= breaks[i]) i++;
      return binColors[i];
    };
    return { breaks, binColors, colorOf };
  }, [shapes, values]);

  const hovered = hover ? shapes.find((s) => s.code === hover.code) : null;
  const hv = hovered ? values[hovered.code] : null;
  const vals = shapes.map((s) => values[s.code]?.value).filter((v): v is number => typeof v === "number");
  const min = vals.length ? Math.min(...vals) : null;
  const max = vals.length ? Math.max(...vals) : null;
  const edges = [min, ...breaks];

  const place = (e: React.PointerEvent<SVGPathElement> | React.FocusEvent<SVGPathElement>, code: string, center = false) => {
    const box = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
    if (center || !("clientX" in e)) {
      const r = e.currentTarget.getBoundingClientRect();
      setHover({ code, x: r.left - box.left + r.width / 2, y: r.top - box.top + r.height / 2 });
    } else {
      setHover({ code, x: e.clientX - box.left, y: e.clientY - box.top });
    }
  };

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-label={`Carte : ${metricLabel}`}>
        {/* Cadres des encarts d'outre-mer */}
        {shapes.filter((s) => s.box).map((s) => (
          <g key={`box-${s.code}`} aria-hidden>
            <rect x={s.box!.x} y={s.box!.y} width={s.box!.w} height={s.box!.h} rx={8} fill="none" stroke="var(--grid)" />
            <text x={s.box!.x + 8} y={s.box!.y + 14} fontSize={10} fill="var(--muted)">{s.name}</text>
          </g>
        ))}
        {shapes.map((s) => {
          const isSel = selected === s.code;
          return (
            <path
              key={s.code}
              d={s.d}
              fill={colorOf(values[s.code]?.value)}
              stroke={isSel ? "var(--ink)" : "var(--surface)"}
              strokeWidth={isSel ? 2 : hover?.code === s.code ? 2 : 0.8}
              strokeLinejoin="round"
              tabIndex={0}
              role={onSelect ? "button" : "img"}
              aria-pressed={onSelect ? isSel : undefined}
              aria-label={`${s.name} : ${fmtValue(values[s.code]?.value ?? null, unit)}`}
              className={`${onSelect ? "cursor-pointer" : ""} outline-none transition-[opacity] hover:opacity-85 focus:opacity-85`}
              onPointerMove={(e) => place(e, s.code)}
              onPointerLeave={() => setHover(null)}
              onFocus={(e) => place(e, s.code, true)}
              onBlur={() => setHover(null)}
              onClick={() => onSelect?.(s.code)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect?.(s.code); } }}
            />
          );
        })}
      </svg>
      {hovered && hover && (
        <div
          className="pointer-events-none absolute z-10 min-w-40 rounded-lg border border-line bg-raised px-3 py-2 text-sm shadow-raised"
          style={{ left: Math.max(0, hover.x + 14), top: hover.y + 14, transform: hover.x > 360 ? "translateX(-110%)" : undefined }}
        >
          <p className="font-medium text-ink">{hovered.name}</p>
          <p><span className="tabular font-semibold">{fmtValue(hv?.value ?? null, unit)}</span> <span className="text-ink-2">{metricLabel.toLowerCase()}</span></p>
          {(hv?.formations !== undefined || onSelect) && (
            <p className="text-xs text-muted">
              {[hv?.formations !== undefined && `${fmtInt(hv.formations)} formations`, onSelect && "clic pour le détail"].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
      )}
      {/* Légende de l'échelle séquentielle (classes de quantiles) */}
      <div className="mt-3 flex flex-wrap items-end gap-x-4 gap-y-2 text-xs text-ink-2">
        <div>
          <p className="mb-1 font-medium">{metricLabel}</p>
          <div className="flex gap-0.5">
            {binColors.map((c, i) => (
              <div key={i} className="w-12">
                <span className={`block h-2.5 ${i === 0 ? "rounded-l-full" : ""} ${i === binColors.length - 1 ? "rounded-r-full" : ""}`} style={{ background: c }} />
                <span className="tabular mt-1 block text-muted">{fmtValue(edges[i] ?? null, unit, true)}</span>
              </div>
            ))}
            <div className="flex items-end"><span className="tabular text-muted">– {fmtValue(max, unit, true)}</span></div>
          </div>
        </div>
        <span className="flex items-center gap-1.5 pb-0.5"><span className="inline-block h-2.5 w-2.5 rounded-sm border border-line bg-surface-2" /> sans donnée</span>
      </div>
    </div>
  );
}
