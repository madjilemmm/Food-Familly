import { NextResponse } from "next/server";
import { noterEtape, type Etape } from "@/lib/etapes";
import { memeSite } from "@/lib/origine";

export const dynamic = "force-dynamic";

/** Les deux étapes que seul le téléphone voit : l'accueil affiché, la liste ouverte. Les autres se comptent côté serveur. */
const DU_TELEPHONE: Etape[] = ["accueil", "liste_ouverte"];

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
