"use client";

import { useCallback, useEffect, useState } from "react";
import { ADRESSE_SESSION_EXPIREE, raisonDeLEchec, SessionExpiree } from "@/lib/reseau";

/**
 * Quand une action n'a pas pu être enregistrée (réseau coupé en magasin…) :
 * l'écran revient à l'état réel tout seul, et ce message dit pourquoi.
 * Placé au même endroit que le toast « Annuler », au-dessus des onglets.
 */
export function useErreurReseau(message = "Pas de réseau : ta dernière action n'est pas passée. Réessaie quand ça revient.") {
  const [texte, setTexte] = useState<string | null>(null);
  useEffect(() => {
    if (!texte) return;
    const t = setTimeout(() => setTexte(null), 5000);
    return () => clearTimeout(t);
  }, [texte]);
  /** Lance l'action ; en cas d'échec, dit pourquoi (l'état optimiste se défait seul). Une session expirée renvoie à l'accueil. */
  const essayer = useCallback(
    async (action: () => Promise<unknown>) => {
      try {
        await action();
        return true;
      } catch (e) {
        if (e instanceof SessionExpiree) window.location.assign(ADRESSE_SESSION_EXPIREE);
        else setTexte(raisonDeLEchec(e, message));
        return false;
      }
    },
    [message],
  );
  const alerte = texte ? (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--onglets)+0.75rem)] z-40 px-4">
      <p role="alert" className="kd-monte mx-auto max-w-xl rounded-pastille bg-aubergine px-4 py-3 text-blanc">
        {texte}
      </p>
    </div>
  ) : null;
  return { essayer, alerte };
}
