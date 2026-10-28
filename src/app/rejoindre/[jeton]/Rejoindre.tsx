"use client";

import { useActionState, useEffect, useState } from "react";
import { isIOS, isStandalone } from "@/components/pwa/device";
import { InstallHelp } from "@/components/pwa/InstallHelp";
import { SubmitButton } from "@/components/SubmitButton";
import { MessageErreur } from "@/components/ui";
import { sansPlantage } from "@/lib/reseau";

type Etat = { error?: string };

/**
 * Entrer à la table en un écran : son prénom, un appui. Sur iPhone, l'appli installée ne partage pas
 * sa mémoire avec Safari : on l'installe d'abord, puis on y colle le lien.
 */
export function Rejoindre({ action, nom, autreFamille }: { action: (prev: Etat, formData: FormData) => Promise<Etat>; nom: string; autreFamille: boolean }) {
  const [installer, setInstaller] = useState<boolean | null>(null);
  const [copie, setCopie] = useState(false);
  const [etat, formAction] = useActionState(sansPlantage(action), {});

  useEffect(() => {
    // Détection côté navigateur uniquement (inconnue au rendu serveur).
    setInstaller(isIOS() && !isStandalone());
  }, []);

  if (installer === null) return <div aria-busy="true" className="min-h-40" />;

  if (installer) {
    return (
      <div className="kd-carte gap-4 p-6">
        <p className="kd-titre-3 text-aubergine">D&apos;abord, installe Kaddie sur ton iPhone</p>
        <InstallHelp />
        <p>Ensuite, ouvre Kaddie et colle ce lien dans « Le code de la famille ».</p>
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard?.writeText(location.href).catch(() => {});
            setCopie(true);
          }}
          className="kd-btn kd-btn--large"
        >
          {copie ? "Lien copié" : "Copier le lien"}
        </button>
        <button onClick={() => setInstaller(false)} className="min-h-14 w-full text-encre-douce underline underline-offset-4">
          Continuer dans Safari quand même
        </button>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {autreFamille && <p className="kd-petit text-center text-blanc">Ce téléphone quittera sa famille actuelle pour rejoindre {nom}.</p>}
      <input name="prenom" aria-label="Ton prénom" required maxLength={40} autoComplete="given-name" placeholder="Ton prénom" className="kd-champ" />
      {etat.error && <MessageErreur>{etat.error}</MessageErreur>}
      <SubmitButton className="kd-btn kd-btn--secondaire kd-btn--large" pendingLabel="J'arrive…">
        Voir le repas du soir
      </SubmitButton>
    </form>
  );
}
