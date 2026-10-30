"use client";

import { useActionState, useRef, useState } from "react";
import { SubmitButton } from "@/components/SubmitButton";
import { MessageErreur } from "@/components/ui";
import { sansPlantage } from "@/lib/reseau";

type Etat = { error?: string; existant?: string };

/**
 * Entrer à la table en un écran : son prénom, un appui. Aucune installation avant : l'appli propose de s'installer
 * plus tard, depuis la liste, avec le code de la famille pour se reconnecter.
 */
export function Rejoindre({ action, nom, autreFamille }: { action: (prev: Etat, formData: FormData) => Promise<Etat>; nom: string; autreFamille: boolean }) {
  const [etat, formAction] = useActionState(sansPlantage(action), {});
  // « Non, quelqu'un d'autre », ou le prénom retouché : la question ne vaut plus, on le complète pour se distinguer (« Karin M. »).
  // Rattaché à la réponse du serveur : une nouvelle réponse repose la question.
  const [retouchePour, setRetouchePour] = useState<Etat | null>(null);
  const champ = useRef<HTMLInputElement>(null);
  // Le prénom est gardé ici : React vide les champs d'un formulaire une fois l'action finie, et la question « c'est toi ? » en a besoin.
  const [prenom, setPrenom] = useState("");
  const retouche = retouchePour === etat;
  const confirmer = Boolean(etat.existant) && !retouche;
  return (
    <form action={formAction} className="flex flex-col gap-3">
      {autreFamille && <p className="kd-petit text-center text-blanc">Ce téléphone quittera sa famille actuelle pour rejoindre {nom}.</p>}
      <input ref={champ} name="prenom" aria-label="Ton prénom" required maxLength={40} autoComplete="given-name" placeholder="Ton prénom" className="kd-champ" value={prenom} onChange={(e) => { setPrenom(e.target.value); if (etat.existant) setRetouchePour(etat); }} onKeyDown={(e) => confirmer && e.key === "Enter" && e.preventDefault()} />
      {etat.error && <MessageErreur>{etat.error}</MessageErreur>}
      {confirmer ? (
        <div role="group" aria-label={`${etat.existant} est déjà dans la famille`} className="flex flex-col gap-3">
          <p className="text-center font-semibold">{etat.existant} est déjà dans la famille. C&apos;est toi&nbsp;?</p>
          {/* Rien que dans cet état : le seul bouton d'envoi de ce bloc est « Oui, c'est moi ». */}
          <input type="hidden" name="confirme" value="1" />
          <SubmitButton className="kd-btn kd-btn--secondaire kd-btn--large" pendingLabel="J'arrive…">
            Oui, c&apos;est moi
          </SubmitButton>
          <button
            type="button"
            onClick={() => {
              setRetouchePour(etat);
              champ.current?.focus();
            }}
            className="min-h-11 px-2 font-semibold underline underline-offset-4"
          >
            Non, quelqu&apos;un d&apos;autre
          </button>
        </div>
      ) : (
        <>
          {etat.existant && retouche && <p className="kd-petit text-center text-blanc">Ajoute une initiale pour vous distinguer, par exemple « {etat.existant} M. ».</p>}
          <SubmitButton className="kd-btn kd-btn--secondaire kd-btn--large" pendingLabel="J'arrive…">
            Voir ce qu&apos;on mange
          </SubmitButton>
        </>
      )}
    </form>
  );
}
