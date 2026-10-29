"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/SubmitButton";
import { MessageErreur } from "@/components/ui";
import { sansPlantage } from "@/lib/reseau";

type Etat = { error?: string };

/**
 * Entrer à la table en un écran : son prénom, un appui. Aucune installation avant : l'appli propose de s'installer
 * plus tard, depuis la liste, avec le code de la famille pour se reconnecter.
 */
export function Rejoindre({ action, nom, autreFamille }: { action: (prev: Etat, formData: FormData) => Promise<Etat>; nom: string; autreFamille: boolean }) {
  const [etat, formAction] = useActionState(sansPlantage(action), {});
  return (
    <form action={formAction} className="flex flex-col gap-3">
      {autreFamille && <p className="kd-petit text-center text-blanc">Ce téléphone quittera sa famille actuelle pour rejoindre {nom}.</p>}
      <input name="prenom" aria-label="Ton prénom" required maxLength={40} autoComplete="given-name" placeholder="Ton prénom" className="kd-champ" />
      {etat.error && <MessageErreur>{etat.error}</MessageErreur>}
      <SubmitButton className="kd-btn kd-btn--secondaire kd-btn--large" pendingLabel="J'arrive…">
        Voir ce qu&apos;on mange
      </SubmitButton>
    </form>
  );
}
