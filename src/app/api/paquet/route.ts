import { after, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDeck, getTasteContext } from "@/lib/data";
import { momentDe } from "@/lib/domain/reco";
import { remplirSiBesoin } from "@/lib/marmiton";
import { cartesPourLEcran } from "@/lib/paquet";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Le paquet de cartes de la personne connectée, tel que « Idées » l'affiche. La pile du téléphone vient le chercher ici pendant qu'on swipe :
 * les actions serveur (un swipe = une action) passent l'une après l'autre, et quand on swipe vite la page n'est plus rafraîchie entre deux ;
 * la pile ne doit pas dépendre de ce rafraîchissement pour recevoir la suite.
 */
export async function GET() {
  const session = await getSession();
  if (!session?.profileId || !session.style) return NextResponse.json({ erreur: "session" }, { status: 401 });
  const [deck, gouts] = await Promise.all([getDeck(session.familyId, session.profileId, momentDe(new Date())), getTasteContext(session.familyId)]);
  after(() => remplirSiBesoin(session.familyId, deck.filter((r) => !r.dejaVu).length));
  return NextResponse.json(cartesPourLEcran(deck, gouts), { headers: { "cache-control": "no-store" } });
}
