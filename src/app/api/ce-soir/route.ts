import { NextResponse } from "next/server";
import { aucuneAllergie, autreIdee, ceSeraCa, changerCeSoir, pourCombien } from "@/app/actions/ce-soir";
import { memeSite } from "@/lib/origine";

export const dynamic = "force-dynamic";

/**
 * Les gestes de « Ce soir » (Ce sera ça, Autre idée, Changer de plat, Non à l'allergie, « pour 4 »).
 * Un simple appel réseau, dont le téléphone attend la réponse avant de recharger l'écran : sur une action serveur,
 * l'attente restait parfois bloquée alors que le choix était enregistré.
 */
export async function POST(req: Request) {
  if (!memeSite(req)) return NextResponse.json({ erreur: "origine" }, { status: 403 });
  const { commande, recipeId, n } = (await req.json().catch(() => ({}))) as { commande?: string; recipeId?: string; n?: number };
  if (commande === "ceSeraCa" && typeof recipeId === "string") await ceSeraCa(recipeId);
  else if (commande === "autreIdee" && typeof recipeId === "string") await autreIdee(recipeId);
  else if (commande === "changer") await changerCeSoir();
  else if (commande === "allergie") await aucuneAllergie();
  else if (commande === "foyer" && typeof n === "number") await pourCombien(n);
  else return NextResponse.json({ erreur: "commande" }, { status: 400 });
  return NextResponse.json({ ok: true });
}
