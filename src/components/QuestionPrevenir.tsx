"use client";

import { BoutonCommande } from "@/components/BoutonCommande";
import { NoterEtape } from "@/components/NoterEtape";
import { EVENEMENT_PREVENIR } from "@/components/PartagerRepas";

// Les mots des boutons ne passent jamais à la ligne : c'est la question, à gauche, qui se serre.
const bouton = "min-h-11 shrink-0 rounded-[0.875rem] border-[3px] border-aubergine px-3.5 font-semibold whitespace-nowrap text-aubergine";

/**
 * « Prévenir la famille ? », juste après « Ce sera ça » : un appui pour ouvrir le message déjà prêt (le plat, la liste faite),
 * un appui pour plus tard. Une seule fois par dîner et par téléphone ; rien n'est jamais envoyé sans l'appui sur « Envoyer ».
 */
export function QuestionPrevenir() {
  return (
    <section aria-label="Prévenir la famille" className="soir-question mt-3 flex flex-wrap items-center gap-3 border-t-2 border-trait pt-3.5">
      <NoterEtape etape="prevenir_propose" frequence="jour" />
      <p className="basis-full text-petit font-medium">Prévenir la famille&nbsp;?</p>
      <BoutonCommande commande="prevenu" reponse="plus_tard" className={bouton}>
        Plus tard
      </BoutonCommande>
      <BoutonCommande commande="prevenu" reponse="oui" onAvant={() => window.dispatchEvent(new Event(EVENEMENT_PREVENIR))} className={bouton}>
        Prévenir
      </BoutonCommande>
    </section>
  );
}
