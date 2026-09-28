"use client";

// Affichage lisible du SQL écrit par l'agent : retours à la ligne sur les clauses et mots-clés colorés.

const CLAUSES = /\s+(?=(WITH|SELECT|FROM|LEFT JOIN|RIGHT JOIN|INNER JOIN|JOIN|WHERE|GROUP BY|HAVING|ORDER BY|LIMIT|UNION ALL|UNION|QUALIFY|WINDOW)\b)/gi;
const KEYWORDS = /\b(WITH|AS|SELECT|DISTINCT|FROM|LEFT|RIGHT|INNER|OUTER|JOIN|ON|USING|WHERE|AND|OR|NOT|IN|IS|NULL|LIKE|ILIKE|BETWEEN|GROUP|BY|HAVING|ORDER|ASC|DESC|LIMIT|UNION|ALL|CASE|WHEN|THEN|ELSE|END|OVER|PARTITION|FILTER|QUALIFY|CAST|NULLIF|COALESCE|ROUND|SUM|COUNT|AVG|MIN|MAX|MEDIAN|CORR|REGR_SLOPE|REGR_R2|QUANTILE_CONT|STDDEV|STRIP_ACCENTS|LOWER|UPPER)\b/gi;

export function formatSql(sql: string) {
  const s = sql.trim();
  return s.includes("\n") ? s : s.replace(CLAUSES, "\n");
}

export function SqlCode({ sql }: { sql: string }) {
  const text = formatSql(sql);
  // Découpage en jetons : chaînes, nombres, mots-clés, reste (rendu en React, sans HTML injecté).
  const parts = text.split(/('(?:[^']|'')*'|\b\d+(?:\.\d+)?\b)/g);
  return (
    <pre className="overflow-x-auto rounded-lg bg-surface-2 px-3 py-2.5 font-mono text-[12px] leading-relaxed text-ink">
      <code>
        {parts.map((p, i) => {
          if (!p) return null;
          if (p.startsWith("'")) return <span key={i} className="text-good">{p}</span>;
          if (/^\d/.test(p)) return <span key={i} className="text-ink-2">{p}</span>;
          const sub = p.split(KEYWORDS);
          return sub.map((w, j) =>
            j % 2 === 1 ? <span key={`${i}-${j}`} className="font-semibold text-accent">{w.toUpperCase()}</span> : <span key={`${i}-${j}`}>{w}</span>);
        })}
      </code>
    </pre>
  );
}
