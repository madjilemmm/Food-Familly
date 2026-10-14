/**
 * Écran de chargement affiché dès qu'on touche un onglet, le temps que les
 * données arrivent : l'appli répond tout de suite au doigt.
 */
export function Skeleton({
  variant = "list",
  header = true,
}: {
  variant?: "list" | "cards" | "deck" | "form";
  /** Faux en-tête (les pages Recettes ont déjà le leur). */
  header?: boolean;
}) {
  const block = "rounded-3xl bg-stone-900/[0.06]";
  return (
    <div aria-busy="true" aria-label="Chargement" className="animate-pulse">
      {header ? (
        <div className="pt-safe flex items-start justify-between pb-4">
          <div className={`mt-1 h-9 w-48 ${block} rounded-xl`} />
          <div className="mt-1 size-12 rounded-full bg-stone-900/[0.06]" />
        </div>
      ) : (
        <div className={`mb-5 h-9 w-48 ${block} rounded-xl`} />
      )}
      {variant === "deck" && (
        <>
          <div className={`mb-4 h-14 ${block} rounded-2xl`} />
          <div className={`aspect-[3/4] max-h-[60dvh] w-full ${block} rounded-[2rem]`} />
          <div className="mt-5 flex justify-center gap-8">
            <div className="size-16 rounded-full bg-stone-900/[0.06]" />
            <div className="size-20 rounded-full bg-stone-900/[0.06]" />
          </div>
        </>
      )}
      {variant === "cards" && (
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className={`aspect-[4/5] ${block} rounded-2xl`} />
          ))}
        </div>
      )}
      {variant === "list" && (
        <div className="space-y-3">
          <div className={`h-32 ${block} rounded-[2rem]`} />
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className={`h-20 ${block}`} />
          ))}
        </div>
      )}
      {variant === "form" && (
        <div className="space-y-4">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className={`h-14 ${block} rounded-2xl`} />
          ))}
        </div>
      )}
    </div>
  );
}
