import type { LucideIcon } from "lucide-react";
import { Sparkline } from "@/components/charts/Sparkline";
import type { Unit } from "@/lib/data/schema";
import { fmtDelta, fmtValue } from "@/lib/format";

interface Props {
  label: string;
  value: number | null;
  unit: Unit;
  previous?: number | null;
  previousLabel?: string;
  /** Sens favorable d'une hausse : colore la variation. null = neutre. */
  upIsGood?: boolean | null;
  hint?: string;
  icon?: LucideIcon;
  /** Série 2021 → 2025 pour la mini-courbe, et index de la session affichée. */
  trend?: (number | null)[];
  trendIndex?: number;
}

export function StatTile({ label, value, unit, previous = null, previousLabel, upIsGood = null, hint, icon: Icon, trend, trendIndex }: Props) {
  const delta = previous !== undefined ? fmtDelta(value, previous, unit) : null;
  const flat = !delta || Math.abs(delta.value) < 0.05;
  const tone = flat || upIsGood === null
    ? "bg-surface-2 text-ink-2"
    : (delta!.value > 0) === upIsGood ? "bg-good-soft text-good" : "bg-bad-soft text-bad";
  return (
    <div className="group flex flex-col justify-between rounded-xl border border-line bg-surface p-4 shadow-card transition-shadow hover:shadow-raised" title={hint}>
      <div className="flex items-center gap-2 text-sm text-ink-2">
        {Icon && (
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface-2 text-muted group-hover:text-accent">
            <Icon size={15} strokeWidth={1.9} />
          </span>
        )}
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-3 flex items-end justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[1.6rem] font-semibold leading-none tracking-tight text-ink">
            {fmtValue(value, unit, unit === "count" && (value ?? 0) >= 1e6)}
          </p>
          {delta && (
            <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
              <span className={`tabular inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-medium ${tone}`}>
                <span aria-hidden>{flat ? "■" : delta.value > 0 ? "▲" : "▼"}</span> {delta.text}
              </span>
              {previousLabel && <span className="text-muted">vs {previousLabel}</span>}
            </p>
          )}
        </div>
        {trend && <div className="shrink-0 pb-0.5"><Sparkline values={trend} highlight={trendIndex} /></div>}
      </div>
    </div>
  );
}
