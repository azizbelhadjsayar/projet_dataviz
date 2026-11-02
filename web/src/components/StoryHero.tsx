import { ArrowRight, MapPinned, Sparkles, Users, GraduationCap } from "lucide-react";
import Link from "next/link";
import { CountUp } from "@/components/CountUp";
import { fmtRatio } from "@/lib/format";

// Écran d'accueil narratif : le constat en chiffres géants et le « graphique en ciseaux »
// (vœux et places en indice base 100, même échelle) qui se dessine à l'arrivée.

interface Point { session: number; voeux: number | null; places: number | null }

interface Props {
  session: number;
  voeux: number | null;
  places: number | null;
  voeuxParPlace: number | null;
  series: Point[];
  /** Filtres conservés dans les liens du parcours (« ?session=…&type=… »). */
  query: string;
  scope: string;
}

const W = 520, H = 250, PAD = { l: 8, r: 92, t: 18, b: 30 };

function Scissors({ series }: { series: Point[] }) {
  const pts = series.filter((p) => p.voeux !== null && p.places !== null) as { session: number; voeux: number; places: number }[];
  if (pts.length < 2) return null;
  const vals = pts.flatMap((p) => [p.voeux, p.places]);
  const lo = Math.min(97, ...vals) - 1, hi = Math.max(103, ...vals) + 1;
  const x = (i: number) => PAD.l + (i * (W - PAD.l - PAD.r)) / (pts.length - 1);
  const y = (v: number) => PAD.t + ((hi - v) * (H - PAD.t - PAD.b)) / (hi - lo);
  const line = (k: "voeux" | "places") => pts.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p[k]).toFixed(1)}`).join("");
  const gap = `${line("voeux")}${[...pts].reverse().map((p, j) => `L${x(pts.length - 1 - j).toFixed(1)},${y(p.places).toFixed(1)}`).join("")}Z`;
  const end = pts.at(-1)!;
  const pct = (v: number) => `${v >= 100 ? "+" : "−"}${fmtRatio(Math.abs(v - 100))} %`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full overflow-visible" role="img"
      aria-label={`Indice base 100 en ${pts[0].session} : vœux ${pct(end.voeux)}, places ${pct(end.places)} en ${end.session}`}>
      <defs>
        <linearGradient id="hero-gap" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="#86b6ef" stopOpacity="0" />
          <stop offset="100%" stopColor="#c4b5fd" stopOpacity="0.45" />
        </linearGradient>
        <filter id="hero-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="4" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      {/* Référence 100 */}
      <line x1={PAD.l} x2={W - PAD.r} y1={y(100)} y2={y(100)} stroke="rgba(255,255,255,0.25)" strokeDasharray="3 5" />
      {pts.map((p, i) => (
        <text key={p.session} x={x(i)} y={H - 8} fontSize={11} textAnchor="middle" fill="rgba(255,255,255,0.6)">{p.session}</text>
      ))}
      <path d={gap} fill="url(#hero-gap)" className="hero-area" />
      <path d={line("places")} pathLength={1} fill="none" stroke="#9ec5f4" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="hero-line" />
      <path d={line("voeux")} pathLength={1} fill="none" stroke="#ffffff" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" filter="url(#hero-glow)" className="hero-line hero-line-2" />
      <circle cx={x(pts.length - 1)} cy={y(end.voeux)} r={5} fill="#fff" className="hero-dot" />
      <circle cx={x(pts.length - 1)} cy={y(end.voeux)} r={5} fill="none" stroke="#fff" className="hero-pulse" />
      <circle cx={x(pts.length - 1)} cy={y(end.places)} r={4} fill="#9ec5f4" className="hero-dot" />
      <g className="hero-label">
        <text x={x(pts.length - 1) + 12} y={y(end.voeux) + 4} fontSize={13} fontWeight={700} fill="#fff">Vœux {pct(end.voeux)}</text>
        <text x={x(pts.length - 1) + 12} y={y(end.places) + 4} fontSize={13} fontWeight={600} fill="#9ec5f4">Places {pct(end.places)}</text>
      </g>
    </svg>
  );
}

const PATH = [
  { href: "/formations", step: "Où ?", label: "Les filières", icon: GraduationCap },
  { href: "/territoires", step: "Où ?", label: "Les territoires", icon: MapPinned },
  { href: "/profils", step: "Pour qui ?", label: "L'équité", icon: Users },
];

export function StoryHero({ session, voeux, places, voeuxParPlace, series, query, scope }: Props) {
  return (
    <section aria-label="Constat et question centrale" className="story-hero mb-6 rounded-3xl p-6 sm:p-9">
      <div aria-hidden className="story-orb story-orb-1" />
      <div aria-hidden className="story-orb story-orb-2" />
      <div aria-hidden className="hero-shine" />
      <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <p className="hero-chip inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/90">
            <span className="live-dot" aria-hidden /> Session {session} · {scope}
          </p>
          <h1 className="font-display mt-5 text-white">
            <span className="hero-number block text-6xl font-extrabold leading-[0.95] tracking-tight sm:text-7xl xl:text-8xl">
              <CountUp value={voeux} unit="count" compact />
            </span>
            <span className="mt-2 block text-2xl font-semibold leading-tight text-white/90 sm:text-3xl">
              de vœux pour <span className="text-white"><CountUp value={places} unit="count" /></span> places
            </span>
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-white/75">
            Soit <strong className="font-semibold text-white">{fmtRatio(voeuxParPlace)} vœux par place</strong>. La demande s&apos;envole, l&apos;offre
            reste stable : la question centrale du projet est de savoir <strong className="font-semibold text-white">où et pour qui l&apos;accès se resserre</strong>.
          </p>
          <div className="mt-6 flex flex-wrap gap-2.5">
            {PATH.map(({ href, step, label, icon: Icon }) => (
              <Link key={href} href={`${href}${query}`} className="hero-pill group inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium text-white">
                <Icon size={15} className="opacity-80" />
                <span className="text-white/60">{step}</span> {label}
                <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
              </Link>
            ))}
            <Link href="/assistant" className="hero-cta inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold">
              <Sparkles size={15} /> Interroger l&apos;agent IA
            </Link>
          </div>
          <p className="mt-6 text-xs text-white/55">
            Pour les responsables de l&apos;offre de formation (ministère, rectorats, établissements) · objectif : décider où ouvrir des places.
          </p>
        </div>
        <div className="glass-panel min-w-0 rounded-2xl p-4 sm:p-5">
          <p className="text-sm font-semibold text-white">L&apos;effet ciseaux</p>
          <p className="mb-3 text-xs text-white/60">Vœux et places en indice base 100 (pointillés = niveau de départ) · même échelle</p>
          <Scissors series={series} />
        </div>
      </div>
    </section>
  );
}
