// Mini-courbe de tendance (tuiles KPI) : trait discret, point de la session courante accentué.
// SVG statique rendu côté serveur, sans interaction (la valeur exacte est dans la tuile et les tableaux).

interface Props {
  values: (number | null)[];
  /** Index du point mis en avant (session sélectionnée). */
  highlight?: number;
  width?: number;
  height?: number;
}

export function Sparkline({ values, highlight = values.length - 1, width = 96, height = 30 }: Props) {
  const pts = values.map((v, i) => ({ v, i })).filter((p): p is { v: number; i: number } => typeof p.v === "number");
  if (pts.length < 2) return null;
  const min = Math.min(...pts.map((p) => p.v));
  const max = Math.max(...pts.map((p) => p.v));
  const pad = 4;
  const x = (i: number) => pad + (i * (width - 2 * pad)) / Math.max(1, values.length - 1);
  const y = (v: number) => (max === min ? height / 2 : pad + ((max - v) * (height - 2 * pad)) / (max - min));
  const d = pts.map((p, k) => `${k ? "L" : "M"}${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`).join("");
  const h = pts.find((p) => p.i === highlight);
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden className="overflow-visible">
      <path d={d} fill="none" stroke="var(--axis)" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
      {h && <circle cx={x(h.i)} cy={y(h.v)} r={3.5} fill="var(--accent)" stroke="var(--surface)" strokeWidth={2} />}
    </svg>
  );
}
