import { NextResponse } from "next/server";
import { aucuneAllergie, autreIdee, ceSeraCa, changerCeSoir } from "@/app/actions/ce-soir";

export const dynamic = "force-dynamic";

/**
 * Les quatre gestes de « Ce soir » (Ce sera ça, Autre idée, Changer de plat, Non à l'allergie).
 * Un simple appel réseau, dont le téléphone attend la réponse avant de recharger l'écran : sur une action serveur,
 * l'attente restait parfois bloquée alors que le choix était enregistré.
 */
export async function POST(req: Request) {
  // Même site seulement.
  const origine = req.headers.get("origin");
  if (origine && new URL(origine).host !== req.headers.get("host")) return NextResponse.json({ erreur: "origine" }, { status: 403 });
  const { commande, recipeId } = (await req.json().catch(() => ({}))) as { commande?: string; recipeId?: string };
  if (commande === "ceSeraCa" && typeof recipeId === "string") await ceSeraCa(recipeId);
  else if (commande === "autreIdee" && typeof recipeId === "string") await autreIdee(recipeId);
  else if (commande === "changer") await changerCeSoir();
  else if (commande === "allergie") await aucuneAllergie();
  else return NextResponse.json({ erreur: "commande" }, { status: 400 });
  return NextResponse.json({ ok: true });
}
