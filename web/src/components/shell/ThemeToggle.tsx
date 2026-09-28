"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme, type Theme } from "./preferences";

const OPTIONS: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Clair", icon: Sun },
  { value: "dark", label: "Sombre", icon: Moon },
  { value: "system", label: "Système", icon: Monitor },
];

/** Sélecteur de thème : segmenté (barre dépliée) ou bouton cyclique (barre réduite). */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const [theme, setTheme] = useTheme();
  const current = OPTIONS.find((o) => o.value === theme) ?? OPTIONS[2];
  const next = OPTIONS[(OPTIONS.indexOf(current) + 1) % OPTIONS.length];

  return (
    <div className={className}>
      <div role="radiogroup" aria-label="Thème" className="sidebar-label flex rounded-lg bg-surface-2 p-0.5">
        {OPTIONS.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={theme === value}
            title={label}
            onClick={() => setTheme(value)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs transition-colors ${
              theme === value ? "bg-surface font-medium text-ink shadow-card" : "text-muted hover:text-ink"
            }`}
          >
            <Icon size={14} strokeWidth={1.9} /> {label}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => setTheme(next.value)}
        title={`Thème : ${current.label} (cliquer pour ${next.label.toLowerCase()})`}
        aria-label={`Thème ${current.label}, passer en ${next.label}`}
        className="sidebar-collapsed-only hidden h-9 w-full items-center justify-center rounded-lg text-ink-2 hover:bg-surface-2 hover:text-ink"
      >
        <current.icon size={17} strokeWidth={1.9} />
      </button>
    </div>
  );
}
