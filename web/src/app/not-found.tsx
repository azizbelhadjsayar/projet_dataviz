import { Compass } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-2 text-muted">
        <Compass size={26} />
      </span>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">Page introuvable</h1>
      <p className="mt-2 max-w-md text-sm text-ink-2">
        Cette page ou cette formation n&apos;existe pas (ou plus) dans les données 2021-2025.
      </p>
      <div className="mt-6 flex gap-2">
        <Link href="/" className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90">Vue d&apos;ensemble</Link>
        <Link href="/explorer" className="rounded-lg border border-line px-4 py-2 text-sm text-ink-2 hover:bg-surface-2">Explorer les formations</Link>
      </div>
    </div>
  );
}
