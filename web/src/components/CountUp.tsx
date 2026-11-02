"use client";

import { useEffect, useRef, useState } from "react";
import type { Unit } from "@/lib/data/schema";
import { fmtValue } from "@/lib/format";

// Chiffre animé jusqu'à sa valeur exacte. Au premier rendu (hydratation), la valeur finale s'affiche
// telle quelle (identique au HTML serveur) ; ensuite (navigation, changement de filtre), le chiffre
// glisse de l'ancienne valeur vers la nouvelle. Aucun mouvement si l'utilisateur réduit les animations.

let hydrated = false;

export function CountUp({ value, unit, compact = false }: { value: number | null; unit: Unit; compact?: boolean }) {
  const [shown, setShown] = useState<number | null>(() => (hydrated && value !== null ? 0 : value));
  const from = useRef(shown);

  useEffect(() => {
    hydrated = true;
  }, []);

  useEffect(() => {
    if (value === null) return;
    const start = from.current ?? 0;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = reduce || start === value ? 0 : 900;
    const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = duration ? Math.min(1, (t - t0) / duration) : 1;
      const cur = p === 1 ? value : start + (value - start) * (1 - (1 - p) ** 3);
      from.current = cur;
      setShown(cur);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return <>{fmtValue(value === null ? null : shown, unit, compact)}</>;
}
