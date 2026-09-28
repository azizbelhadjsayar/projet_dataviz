"use client";

import type { Unit } from "@/lib/data/schema";
import { fmtPct, fmtValue } from "@/lib/format";
import { FloatingTip, Legend, useTip, useWidth, type Series } from "./common";

interface Item {
  label: string;
  v: number;
  /** Clé de série du groupe (treemap à deux niveaux). */
  group?: string;
  parent?: string;
}
interface Rect { x: number; y: number; w: number; h: number }

/** Découpage « squarified » (Bruls et al.) : tuiles aussi carrées que possible, par valeur décroissante. */
function squarify<T extends { v: number }>(items: T[], rect: Rect): (T & Rect)[] {
  const total = items.reduce((a, it) => a + it.v, 0);
  if (total <= 0 || rect.w <= 0 || rect.h <= 0) return [];
  const scale = (rect.w * rect.h) / total;
  const queue = items.filter((it) => it.v > 0).map((it) => ({ it, area: it.v * scale }));
  const out: (T & Rect)[] = [];
  const worst = (row: typeof queue, side: number) => {
    const s = row.reduce((a, r) => a + r.area, 0);
    const max = Math.max(...row.map((r) => r.area)), min = Math.min(...row.map((r) => r.area));
    return Math.max((side * side * max) / (s * s), (s * s) / (side * side * min));
  };
  const place = (row: typeof queue, r: Rect): Rect => {
    const s = row.reduce((a, q) => a + q.area, 0);
    if (r.w >= r.h) {
      const w = s / r.h;
      let y = r.y;
      for (const q of row) { const h = q.area / w; out.push({ ...q.it, x: r.x, y, w, h }); y += h; }
      return { x: r.x + w, y: r.y, w: r.w - w, h: r.h };
    }
    const h = s / r.w;
    let x = r.x;
    for (const q of row) { const w = q.area / h; out.push({ ...q.it, x, y: r.y, w, h }); x += w; }
    return { x: r.x, y: r.y + h, w: r.w, h: r.h - h };
  };
  let r = rect;
  let row: typeof queue = [];
  for (let i = 0; i < queue.length;) {
    const side = Math.min(r.w, r.h);
    if (!row.length || worst([...row, queue[i]], side) <= worst(row, side)) { row.push(queue[i]); i++; }
    else { r = place(row, r); row = []; }
  }
  if (row.length) place(row, r);
  return out;
}

interface Props {
  data: Record<string, string | number | null>[];
  /** Un seul élément = treemap simple (teinte séquentielle par rang) ; sinon groupes colorés. */
  series: Series[];
  unit: Unit;
  metricLabel: string;
}

/**
 * Treemap : parts d'un total quand il y a trop de catégories pour un anneau, ou deux niveaux
 * (groupe coloré → éléments). Surface = valeur ; 2 px d'écart entre les tuiles ; libellés si la tuile est assez grande.
 */
export function Treemap({ data, series, unit, metricLabel }: Props) {
  const [box, width] = useWidth();
  const { ref, tip, bind } = useTip<Item & { share: number }>();
  const grouped = series.length > 1 || series[0]?.key.startsWith("s");
  const height = Math.round(Math.min(440, Math.max(260, width * 0.56)));
  const items: Item[] = data.map((d) => ({
    label: String(d.label), v: typeof d.y0 === "number" ? d.y0 : 0,
    group: d.group ? String(d.group) : undefined, parent: d.parent ? String(d.parent) : undefined,
  }));
  const total = items.reduce((a, it) => a + it.v, 0);

  let tiles: (Item & Rect)[] = [];
  if (width > 0) {
    const full = { x: 0, y: 0, w: width, h: height };
    if (grouped) {
      // Groupes d'abord (par total), puis les éléments dans chaque groupe.
      const groups = series.map((s) => ({ key: s.key, v: items.filter((it) => it.group === s.key).reduce((a, it) => a + it.v, 0) }))
        .sort((a, b) => b.v - a.v);
      for (const g of squarify(groups, full)) {
        const inner = { x: g.x + 1, y: g.y + 1, w: g.w - 2, h: g.h - 2 };
        tiles.push(...squarify(items.filter((it) => it.group === g.key).sort((a, b) => b.v - a.v), inner));
      }
    } else {
      tiles = squarify([...items].sort((a, b) => b.v - a.v), full);
    }
  }
  // Teinte séquentielle par rang (treemap simple) : les plus grandes parts en foncé.
  // Le groupe d'origine distingue deux éléments homonymes réunis dans « Autres » (ex. même filière en PASS et en L.AS).
  const idOf = (it: Item) => `${it.group ?? ""}|${it.parent ?? ""}|${it.label}`;
  const rank = new Map([...items].sort((a, b) => b.v - a.v).map((it, i) => [idOf(it), i]));
  const stepOf = (it: Item) => 6 - Math.min(4, Math.floor(((rank.get(idOf(it)) ?? 0) * 5) / Math.max(1, items.length)));
  const colorOf = (key?: string) => series.find((s) => s.key === key);

  return (
    <div>
      {grouped && <Legend series={series} />}
      <div ref={ref} className="relative">
        <div ref={box} className="relative w-full overflow-hidden rounded-lg" style={{ height }}>
          {tiles.map((t) => {
            const s = grouped ? colorOf(t.group) : undefined;
            const w = t.w - 2, h = t.h - 2;
            const share = total > 0 ? (100 * t.v) / total : 0;
            return (
              <div
                key={idOf(t)}
                {...bind({ ...t, share })}
                className={`absolute overflow-hidden rounded-[4px] px-1.5 py-1 leading-tight transition-opacity hover:opacity-85 ${grouped ? "" : `heat-cell heat-${stepOf(t)}`}`}
                style={{ left: t.x + 1, top: t.y + 1, width: Math.max(0, w), height: Math.max(0, h), ...(s ? { background: s.color, color: s.ink } : {}) }}
              >
                {w >= 46 && h >= 22 && <p className="truncate text-[12px] font-semibold">{t.label}</p>}
                {w >= 64 && h >= 38 && <p className="tabular truncate text-[11px] opacity-90">{fmtValue(t.v, unit, true)} · {fmtPct(share)}</p>}
              </div>
            );
          })}
        </div>
        {tip && (
          <FloatingTip {...tip}>
            <p className="font-medium text-ink">{tip.item.label}</p>
            {tip.item.parent && <p className="text-xs text-ink-2">{tip.item.parent}</p>}
            <p className="mt-0.5">
              <span className="tabular font-semibold text-ink">{fmtValue(tip.item.v, unit)}</span>
              <span className="text-ink-2"> · {fmtPct(tip.item.share)} du total</span>
            </p>
          </FloatingTip>
        )}
      </div>
      <p className="mt-2 text-[11px] text-muted">
        Surface proportionnelle : {metricLabel.toLowerCase()} · total {fmtValue(total, unit, true)}{grouped ? "" : " · teinte plus foncée = part plus grande"}.
      </p>
    </div>
  );
}
