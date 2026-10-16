"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Quand une action n'a pas pu être enregistrée (réseau coupé en magasin…) :
 * l'écran revient à l'état réel tout seul, et ce message dit pourquoi.
 * Placé au même endroit que le toast « Annuler », au-dessus des onglets.
 */
export function useErreurReseau(message = "Pas de réseau : ta dernière action n'est pas passée. Réessaie quand ça revient.") {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => setVisible(false), 5000);
    return () => clearTimeout(t);
  }, [visible]);
  /** Lance l'action ; en cas d'échec, affiche le message (l'état optimiste se défait seul). */
  const essayer = useCallback(async (action: () => Promise<unknown>) => {
    try {
      await action();
      return true;
    } catch {
      setVisible(true);
      return false;
    }
  }, []);
  const alerte = visible ? (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(4.75rem+max(env(safe-area-inset-bottom),0.75rem))] z-40 px-4">
      <p role="alert" className="kd-monte mx-auto max-w-xl rounded-pastille bg-aubergine px-4 py-3 text-blanc">
        {message}
      </p>
    </div>
  ) : null;
  return { essayer, alerte };
}
