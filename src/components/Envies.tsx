import Link from "next/link";
import { IconeCoeur, IconeRetour } from "@/components/ui";

/** Tant que le questionnaire de goûts n'est pas rempli : facultatif, Kaddie apprend aussi des swipes. */
export function CarteGouts({ retour }: { retour: string }) {
  return (
    <Link
      href={`/profil/gouts?suite=${encodeURIComponent(retour)}`}
      className="mb-4 flex min-h-14 items-center gap-3 rounded-bouton bg-blanc px-4 py-2 text-petit leading-snug font-semibold text-aubergine active:scale-[0.98]"
    >
      <IconeCoeur className="size-6 shrink-0 text-violet" />
      <span className="flex-1">Tes goûts en détail, si tu veux</span>
      <IconeRetour className="size-6 rotate-180 text-violet" />
    </Link>
  );
}

/** Seul·e dans la famille : un appui pour inviter les autres (le lien est dans Ma famille). */
export function CarteInviter() {
  return (
    <Link
      href="/famille"
      className="mb-4 flex min-h-14 items-center gap-3 rounded-bouton bg-blanc px-4 py-2 text-petit leading-snug font-semibold text-aubergine active:scale-[0.98]"
    >
      <IconeCoeur className="size-6 shrink-0 text-violet" />
      <span className="flex-1">Invite ta famille : les plats que vous aimez tous passent en premier</span>
      <IconeRetour className="size-6 rotate-180 text-violet" />
    </Link>
  );
}
