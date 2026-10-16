import { Logo } from "@/design-system/components/Kaddie";
import Link from "next/link";
import { IconeCoeur, IconeRetour, LienReglages } from "@/components/ui";
import { NotificationsCard } from "@/components/pwa/NotificationsCard";

/** En-tête des envies : monogramme, pastille des matchs, notifs, réglages. */
export function SwipeHeader({ matchs }: { matchs: number }) {
  return (
    <header className="flex items-center gap-3 pt-2">
      <Logo variante="monogramme" width={34} />
      {/* Les matchs de la famille, à un appui (ils n'ont plus d'onglet à eux). */}
      <Link href="/matchs" className="kd-pastille kd-pastille--match flex min-h-11 items-center px-4 active:scale-95">
        {matchs > 0 ? `${matchs} match${matchs > 1 ? "s" : ""}` : "Matchs"}
      </Link>
      <span className="ml-auto flex gap-2">
        <NotificationsCard variant="icone" />
        <LienReglages surScene />
      </span>
    </header>
  );
}

/** Tant que le questionnaire de goûts n'est pas rempli (passé avec « Plus tard »). */
export function CarteGouts({ retour }: { retour: string }) {
  return (
    <Link
      href={`/profil/gouts?suite=${encodeURIComponent(retour)}`}
      className="flex min-h-14 items-center gap-3 rounded-bouton bg-blanc px-4 py-2 text-petit leading-snug font-semibold text-aubergine active:scale-[0.98]"
    >
      <IconeCoeur className="size-6 shrink-0 text-violet" />
      <span className="flex-1">Dis-nous ce que tu n&apos;aimes pas</span>
      <IconeRetour className="size-6 rotate-180 text-violet" />
    </Link>
  );
}
