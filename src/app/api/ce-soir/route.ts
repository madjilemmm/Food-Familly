import { NextResponse } from "next/server";
import { aucuneAllergie, autreIdee, ceSeraCa, changerCeSoir, defaireCeSoir, pourCombien, prevenuAujourdhui } from "@/app/actions/ce-soir";
import { memeSite } from "@/lib/origine";

export const dynamic = "force-dynamic";

/**
 * Les gestes de « Ce soir » (Ce sera ça, Autre idée, Changer de plat, Non à l'allergie, « pour 4 », « Prévenir la famille ? »).
 * Un simple appel réseau, dont le téléphone attend la réponse avant de recharger l'écran : sur une action serveur,
 * l'attente restait parfois bloquée alors que le choix était enregistré.
 */
export async function POST(req: Request) {
  if (!memeSite(req)) return NextResponse.json({ erreur: "origine" }, { status: 403 });
  const { commande, recipeId, n, raison, reponse } = (await req.json().catch(() => ({}))) as {
    commande?: string;
    recipeId?: string;
    n?: number;
    raison?: string;
    reponse?: string;
  };
  // « dejaChoisi » : quelqu'un a décidé avant, l'écran se recharge sur son choix.
  if (commande === "ceSeraCa" && typeof recipeId === "string") return NextResponse.json({ ok: true, ...(await ceSeraCa(recipeId, typeof raison === "string" ? raison : undefined)) });
  else if (commande === "autreIdee" && typeof recipeId === "string") await autreIdee(recipeId);
  else if (commande === "defaire" && typeof recipeId === "string") await defaireCeSoir(recipeId);
  else if (commande === "changer") await changerCeSoir();
  else if (commande === "allergie") await aucuneAllergie();
  else if (commande === "foyer" && typeof n === "number") await pourCombien(n);
  else if (commande === "prevenu" && (reponse === "oui" || reponse === "plus_tard")) await prevenuAujourdhui(reponse === "oui");
  else return NextResponse.json({ erreur: "commande" }, { status: 400 });
  return NextResponse.json({ ok: true });
}
