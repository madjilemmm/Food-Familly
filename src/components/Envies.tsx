import Link from "next/link";
import { IconeCoeur, IconeRetour } from "@/components/ui";

/** Les matchs de la famille, à un appui depuis le bandeau : un cœur, et leur nombre en pastille. */
export function BoutonMatchs({ matchs }: { matchs: number }) {
  return (
    <Link
      href="/matchs"
      aria-label={matchs > 0 ? `${matchs} match${matchs > 1 ? "s" : ""}` : "Matchs"}
      className="relative flex size-14 shrink-0 items-center justify-center rounded-full bg-blanc text-aubergine active:scale-95"
    >
      <IconeCoeur className="size-7" />
      {matchs > 0 && (
        <span
          aria-hidden
          className="absolute -top-1 -right-1 min-w-6 rounded-full bg-accent px-1.5 text-center text-etiquette leading-6 font-bold text-on-accent ring-3 ring-blanc"
        >
          {matchs > 99 ? "99+" : matchs}
        </span>
      )}
    </Link>
  );
}

/** Tant que le questionnaire de goûts n'est pas rempli (passé avec « Plus tard »). */
export function CarteGouts({ retour }: { retour: string }) {
  return (
    <Link
      href={`/profil/gouts?suite=${encodeURIComponent(retour)}`}
      className="mb-4 flex min-h-14 items-center gap-3 rounded-bouton bg-blanc px-4 py-2 text-petit leading-snug font-semibold text-aubergine active:scale-[0.98]"
    >
      <IconeCoeur className="size-6 shrink-0 text-violet" />
      <span className="flex-1">Dis-nous ce que tu n&apos;aimes pas</span>
      <IconeRetour className="size-6 rotate-180 text-violet" />
    </Link>
  );
}
