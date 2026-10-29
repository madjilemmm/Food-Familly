"use client";

import { useEffect, useState } from "react";
import { isIOS, isStandalone } from "./device";
import { InstallHelp } from "./InstallHelp";

const CLE = "kaddie.installer.plus-tard";

/**
 * Sur le Caddie d'un iPhone resté dans Safari : proposer de garder Kaddie sur l'écran d'accueil, quand les alertes
 * ont un sens. L'appli installée ne partage pas la mémoire de Safari : on donne le code de la famille à taper une fois.
 */
export function InstallerKaddie({ code }: { code: string }) {
  // null tant qu'on ne sait pas : rien ne s'affiche (inconnu au rendu serveur), pas de carte qui saute.
  const [visible, setVisible] = useState<boolean | null>(null);
  const [comment, setComment] = useState(false);

  useEffect(() => {
    let plusTard = false;
    try {
      plusTard = localStorage.getItem(CLE) === "1";
    } catch {}
    setVisible(isIOS() && !isStandalone() && !plusTard);
  }, []);

  if (!visible) return null;

  return (
    <section aria-label="Garder Kaddie sur l'écran d'accueil" className="mt-8 flex flex-col gap-2 border-t-2 border-trait pt-4">
      <p>
        <strong>Garde Kaddie sur ton écran d&apos;accueil</strong> pour être prévenu·e quand la famille répond.
      </p>
      <p className="kd-petit">Dans l&apos;appli installée, tape ce code une seule fois&nbsp;:</p>
      <p className="font-display text-titre-3 break-all text-aubergine">{code}</p>
      {comment && <InstallHelp />}
      <div className="-ml-3 flex">
        {!comment && (
          <button type="button" onClick={() => setComment(true)} className="min-h-11 px-3 font-semibold text-violet">
            Voir comment
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            try {
              localStorage.setItem(CLE, "1");
            } catch {}
            setVisible(false);
          }}
          className="min-h-11 px-3 font-semibold text-violet"
        >
          Plus tard
        </button>
      </div>
    </section>
  );
}
