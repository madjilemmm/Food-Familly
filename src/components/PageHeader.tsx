import Link from "next/link";

export function PageHeader({ title, subtitle, big = false }: { title: string; subtitle?: string; big?: boolean }) {
  return (
    <header className="pt-safe flex items-start justify-between gap-4 pb-4">
      <div>
        <h1 className={`${big ? "text-4xl" : "text-3xl"} font-extrabold tracking-tight`}>{title}</h1>
        {subtitle && <p className="mt-1 text-lg text-stone-500">{subtitle}</p>}
      </div>
      <Link
        href="/reglages"
        aria-label="Réglages"
        className="mt-1 flex size-12 shrink-0 items-center justify-center rounded-full bg-white text-2xl shadow-sm active:scale-95"
      >
        ⚙️
      </Link>
    </header>
  );
}
