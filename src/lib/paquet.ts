import "server-only";
import { allergenesSurLaCarte } from "@/lib/domain/foods";
import type { getDeck, getTasteContext } from "@/lib/data";

/** Les cartes telles que l'écran « Idées » les affiche : le paquet, avec les allergènes courants dits sur la carte. */
export function cartesPourLEcran(deck: Awaited<ReturnType<typeof getDeck>>, gouts: Awaited<ReturnType<typeof getTasteContext>>) {
  return deck.map((r) => ({ ...r, contient: allergenesSurLaCarte(gouts.texts.get(r.id) ?? [r.title]) }));
}
