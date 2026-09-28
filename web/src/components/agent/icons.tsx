// Icônes SVG légères (trait 1,75 px, currentColor) pour l'interface de l'agent.
import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;
const base = (p: P) => ({
  width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor",
  strokeWidth: 1.75, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true, ...p,
});

export const SparklesIcon = (p: P) => (
  <svg {...base(p)}><path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z" /><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" /></svg>
);
export const ArrowUpIcon = (p: P) => <svg {...base(p)}><path d="M12 19V5M5 12l7-7 7 7" /></svg>;
export const StopIcon = (p: P) => <svg {...base(p)}><rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" /></svg>;
export const DatabaseIcon = (p: P) => (
  <svg {...base(p)}><ellipse cx="12" cy="5.5" rx="7" ry="2.5" /><path d="M5 5.5v13c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5v-13" /><path d="M5 12c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5" /></svg>
);
export const ChartIcon = (p: P) => <svg {...base(p)}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>;
export const CheckIcon = (p: P) => <svg {...base(p)}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>;
export const XIcon = (p: P) => <svg {...base(p)}><path d="M6 6l12 12M18 6L6 18" /></svg>;
export const ChevronIcon = (p: P) => <svg {...base(p)}><path d="M9 6l6 6-6 6" /></svg>;
export const CopyIcon = (p: P) => <svg {...base(p)}><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 012-2h9" /></svg>;
export const RefreshIcon = (p: P) => <svg {...base(p)}><path d="M20 11a8 8 0 10-2.3 5.7M20 20v-5h-5" /></svg>;
export const PlusIcon = (p: P) => <svg {...base(p)}><path d="M12 5v14M5 12h14" /></svg>;
export const ArrowDownIcon = (p: P) => <svg {...base(p)}><path d="M12 5v14M19 12l-7 7-7-7" /></svg>;
export const TrendIcon = (p: P) => <svg {...base(p)}><path d="M3 17l6-6 4 4 8-8M15 7h6v6" /></svg>;
export const ScaleIcon = (p: P) => <svg {...base(p)}><path d="M12 4v16M5 20h14M6 8h12M6 8l-3 6a3 3 0 006 0zM18 8l-3 6a3 3 0 006 0z" /></svg>;
export const UsersIcon = (p: P) => <svg {...base(p)}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0113 0M16 4.5a3.5 3.5 0 010 7M18 14a6.5 6.5 0 013.5 6" /></svg>;
export const MapIcon = (p: P) => <svg {...base(p)}><path d="M9 4L3 6.5v13.5L9 17.5l6 2.5 6-2.5V4l-6 2.5z" /><path d="M9 4v13.5M15 6.5V20" /></svg>;
export const LinkIcon = (p: P) => <svg {...base(p)}><path d="M3 12h4l3-7 4 14 3-7h4" /></svg>;
export const BookIcon = (p: P) => <svg {...base(p)}><path d="M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2zM4 19V5" /></svg>;

export const PanelIcon = (p: P) => <svg {...base(p)}><rect x="3" y="4" width="18" height="16" rx="2.5" /><path d="M9 4v16" /></svg>;
export const SearchIcon = (p: P) => <svg {...base(p)}><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.2-4.2" /></svg>;
export const PinIcon = (p: P) => <svg {...base(p)}><path d="M9 4h6l-1 5 3 3v2H7v-2l3-3zM12 14v6" /></svg>;
export const PencilIcon = (p: P) => <svg {...base(p)}><path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" /></svg>;
export const TrashIcon = (p: P) => <svg {...base(p)}><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></svg>;
export const ChatIcon = (p: P) => <svg {...base(p)}><path d="M4 5h16v11H9l-5 4z" /></svg>;
export const MemoryIcon = (p: P) => <svg {...base(p)}><path d="M9 4a3 3 0 00-3 3v.5A3 3 0 004 10.5 3 3 0 005.5 13 3.5 3.5 0 009 18.5V4zM15 4a3 3 0 013 3v.5a3 3 0 012 3 3 3 0 01-1.5 2.5 3.5 3.5 0 01-3.5 5.5V4z" /></svg>;

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden className={`animate-spin-slow ${className}`}>
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" />
      <path d="M21 12a9 9 0 00-9-9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function AgentAvatar({ size = 28 }: { size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full text-white shadow-sm"
      style={{ width: size, height: size, background: "linear-gradient(135deg, var(--accent), #4a3aa7)" }}
    >
      <SparklesIcon width={size * 0.55} height={size * 0.55} />
    </span>
  );
}
