import { startTrip } from "@/app/actions/trips";
import type { DepartureChoice } from "@/lib/domain/trip";

/**
 * « Je pars dans… » en simple formulaire HTML : le navigateur envoie, le serveur
 * redirige vers l'écran des courses. Rien à faire côté React, donc rien qui reste en attente.
 */
export async function POST(request: Request) {
  const form = await request.formData();
  // startTrip redirige vers l'écran des courses de la personne (même en cas de refus, l'écran l'explique).
  await startTrip(String(form.get("choice")) as DepartureChoice);
}
