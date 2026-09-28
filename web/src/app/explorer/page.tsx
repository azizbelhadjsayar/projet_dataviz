import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, ChartLine, ExternalLink, Search, SearchX } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { FilterBar } from "@/components/FilterBar";
import { PageHeader } from "@/components/PageHeader";
import { PageTransition } from "@/components/PageTransition";
import { SearchBox } from "@/components/SearchBox";
import { Badge } from "@/components/ui/Badge";
import { searchFormations } from "@/lib/data/query";
import type { MetricId } from "@/lib/data/schema";
import { parseFilters, type SearchParams } from "@/lib/filters";
import { fmtInt, fmtPct, fmtRatio } from "@/lib/format";
import { filterOptions } from "@/lib/page-data";

const PAGE_SIZE = 25;
const COLUMNS: { key: MetricId; label: string; fmt: (v: number | null) => string }[] = [
  { key: "capacite", label: "Places", fmt: (v) => fmtInt(v) },
  { key: "voeux_pp", label: "Vœux PP", fmt: (v) => fmtInt(v) },
  { key: "voeux_par_place", label: "Vœux / place", fmt: (v) => fmtRatio(v) },
  { key: "taux_acces_moyen", label: "Taux d'accès", fmt: (v) => fmtPct(v) },
  { key: "admis_total", label: "Admis", fmt: (v) => fmtInt(v) },
];

export const metadata = { title: "Explorer les formations" };

export default async function ExplorerPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const f = parseFilters(sp);
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]![0] : (sp[k] as string | undefined));
  const q = one("q") ?? "";
  const sort = COLUMNS.some((c) => c.key === one("sort")) ? (one("sort") as MetricId) : "voeux_pp";
  const order = one("order") === "asc" ? "asc" : "desc";
  const page = Math.max(1, Number(one("page")) || 1);

  const res = searchFormations({
    q, filters: f.withSession, sortBy: sort, order, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE,
    metrics: COLUMNS.map((c) => c.key),
  });
  const pages = Math.max(1, Math.ceil(res.total / PAGE_SIZE));
  const href = (patch: Record<string, string>) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) if (typeof v === "string") next.set(k, v);
    for (const [k, v] of Object.entries(patch)) next.set(k, v);
    return `/explorer?${next.toString()}`;
  };
  const sortHref = (key: MetricId) => href({ sort: key, order: sort === key && order === "desc" ? "asc" : "desc", page: "1" });

  return (
    <PageTransition>
      <PageHeader title="Explorer les formations" eyebrow="Exploration" icon={Search}>
        Recherchez une formation précise et comparez ses chiffres pour la session choisie. « Évolution » ouvre sa fiche 2021-2025,
        « Parcoursup » renvoie vers la fiche officielle.
      </PageHeader>
      <Suspense>
        <FilterBar options={filterOptions()} />
        <SearchBox total={res.total} />
      </Suspense>

      <section className="overflow-hidden rounded-xl border border-line bg-surface shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3 text-sm text-ink-2">
          <p>
            <strong className="tabular text-ink">{fmtInt(res.total)}</strong> formation{res.total > 1 ? "s" : ""} · session {f.session}
            {q && <> · « {q} »</>}
          </p>
          <p className="text-xs text-muted">Tri : {COLUMNS.find((c) => c.key === sort)?.label} ({order === "desc" ? "décroissant" : "croissant"})</p>
        </div>

        {!res.rows.length ? (
          <div className="flex flex-col items-center px-4 py-14 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-2 text-muted"><SearchX size={22} /></span>
            <p className="mt-3 font-medium text-ink">Aucune formation ne correspond</p>
            <p className="mt-1 max-w-md text-sm text-ink-2">Essayez un mot-clé plus court (« info » plutôt que « informatique appliquée »), retirez un filtre ou changez de session.</p>
          </div>
        ) : (
          <>
            {/* Bureau : tableau triable */}
            <div className="hidden overflow-x-auto md:block">
              <table className="tabular w-full border-collapse text-sm">
                <thead className="bg-surface-2">
                  <tr className="text-xs text-ink-2">
                    <th className="px-4 py-2.5 text-left font-semibold">Formation</th>
                    <th className="px-3 py-2.5 text-left font-semibold">Lieu</th>
                    {COLUMNS.map((c) => (
                      <th key={c.key} className="px-3 py-2.5 text-right font-semibold" aria-sort={sort === c.key ? (order === "asc" ? "ascending" : "descending") : "none"}>
                        <Link href={sortHref(c.key)} scroll={false} className={`inline-flex items-center gap-1 whitespace-nowrap hover:text-ink ${sort === c.key ? "text-ink" : ""}`}>
                          {c.label}
                          {sort === c.key ? (order === "desc" ? <ArrowDown size={12} /> : <ArrowUp size={12} />) : <ArrowUpDown size={12} className="text-muted" />}
                        </Link>
                      </th>
                    ))}
                    <th className="px-4 py-2.5"><span className="sr-only">Liens</span></th>
                  </tr>
                </thead>
                <tbody>
                  {res.rows.map((r) => (
                    <tr key={String(r.cod_aff_form)} className="group border-b border-grid align-top last:border-0 hover:bg-surface-2/50">
                      <td className="max-w-md px-4 py-3">
                        <Link href={`/explorer/${r.cod_aff_form}`} className="font-medium text-ink hover:text-accent">{r.formation}</Link>
                        <p className="mt-0.5 text-xs text-ink-2">{r.etablissement}</p>
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          <Badge tone="accent">{r.type_formation}</Badge>
                          <Badge>{r.selectivite}</Badge>
                          <Badge tone="outline">{r.secteur}</Badge>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-ink-2">
                        {r.commune}
                        <p className="text-xs text-muted">{r.departement}</p>
                      </td>
                      {COLUMNS.map((c) => (
                        <td key={c.key} className={`whitespace-nowrap px-3 py-3 text-right ${sort === c.key ? "font-semibold text-ink" : "text-ink-2"}`}>
                          {c.fmt(r[c.key] as number | null)}
                        </td>
                      ))}
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <span className="inline-flex gap-1 opacity-70 transition-opacity group-hover:opacity-100">
                          <Link href={`/explorer/${r.cod_aff_form}`} title="Évolution 2021-2025" aria-label="Évolution 2021-2025"
                            className="rounded-lg p-1.5 text-ink-2 hover:bg-surface hover:text-accent"><ChartLine size={16} /></Link>
                          <a href={String(r.lien)} target="_blank" rel="noreferrer" title="Fiche Parcoursup" aria-label="Fiche Parcoursup (nouvel onglet)"
                            className="rounded-lg p-1.5 text-ink-2 hover:bg-surface hover:text-accent"><ExternalLink size={16} /></a>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile : cartes */}
            <ul className="divide-y divide-grid md:hidden">
              {res.rows.map((r) => (
                <li key={String(r.cod_aff_form)} className="px-4 py-4">
                  <Link href={`/explorer/${r.cod_aff_form}`} className="font-medium text-ink">{r.formation}</Link>
                  <p className="mt-0.5 text-xs text-ink-2">{r.etablissement} · {r.commune}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    <Badge tone="accent">{r.type_formation}</Badge>
                    <Badge>{r.selectivite}</Badge>
                    <Badge tone="outline">{r.secteur}</Badge>
                  </div>
                  <dl className="tabular mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                    {COLUMNS.slice(1, 4).map((c) => (
                      <div key={c.key} className="rounded-lg bg-surface-2 px-2 py-1.5">
                        <dt className="text-muted">{c.label}</dt>
                        <dd className="mt-0.5 font-semibold text-ink">{c.fmt(r[c.key] as number | null)}</dd>
                      </div>
                    ))}
                  </dl>
                  <div className="mt-2 flex gap-4 text-xs">
                    <Link href={`/explorer/${r.cod_aff_form}`} className="text-accent">Évolution 2021-2025</Link>
                    <a href={String(r.lien)} target="_blank" rel="noreferrer" className="text-accent">Parcoursup ↗</a>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}

        {pages > 1 && (
          <nav className="flex items-center justify-between gap-2 border-t border-line px-4 py-3 text-sm" aria-label="Pagination">
            {page > 1 ? (
              <Link href={href({ page: String(page - 1) })} className="inline-flex items-center gap-1 rounded-lg border border-line px-3 py-1.5 text-ink-2 hover:bg-surface-2 hover:text-ink">
                <ChevronLeft size={15} /> Précédent
              </Link>
            ) : <span />}
            <span className="tabular text-ink-2">Page {page} sur {fmtInt(pages)}</span>
            {page < pages ? (
              <Link href={href({ page: String(page + 1) })} className="inline-flex items-center gap-1 rounded-lg border border-line px-3 py-1.5 text-ink-2 hover:bg-surface-2 hover:text-ink">
                Suivant <ChevronRight size={15} />
              </Link>
            ) : <span />}
          </nav>
        )}
      </section>
    </PageTransition>
  );
}
