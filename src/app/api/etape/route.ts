import { NextResponse } from "next/server";
import { noterEtape, type Etape } from "@/lib/etapes";
import { memeSite } from "@/lib/origine";

export const dynamic = "force-dynamic";

/** Les étapes que seul le téléphone voit : l'accueil, la liste ouverte, « Ce soir » affiché, la question « Prévenir ? », comment Kaddie s'ouvre. */
const DU_TELEPHONE: Etape[] = ["accueil", "liste_ouverte", "ce_soir_affiche", "prevenir_propose", "ouverture_icone", "ouverture_notification"];

/**
 * Compte une étape du début : un total par jour, sans identifiant (voir /confidentialite). Ouvert sans connexion,
 * puisque l'accueil s'affiche avant la création de la famille ; la page vide répond toujours pareil.
 */
export async function POST(req: Request) {
  if (!memeSite(req)) return NextResponse.json({ erreur: "origine" }, { status: 403 });
  const { etape } = (await req.json().catch(() => ({}))) as { etape?: string };
  const connue = DU_TELEPHONE.find((e) => e === etape);
  if (connue) await noterEtape(connue);
  return new NextResponse(null, { status: 204 });
}
