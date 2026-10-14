"use client";

import { useEffect, useState } from "react";
import { isIOS, isStandalone } from "@/components/pwa/device";
import { InstallHelp } from "@/components/pwa/InstallHelp";

/**
 * Sur iPhone, l'appli installée sur l'écran d'accueil ne partage pas sa
 * mémoire avec Safari : on invite donc à l'installer AVANT de saisir le code.
 */
export function InstallFirst({ children }: { children: React.ReactNode }) {
  const [mustInstall, setMustInstall] = useState(false);
  const [skipped, setSkipped] = useState(false);

  useEffect(() => {
    // Détection côté navigateur uniquement (inconnue au rendu serveur).
    setMustInstall(isIOS() && !isStandalone());
  }, []);

  if (!mustInstall || skipped) return <>{children}</>;

  return (
    <div className="kd-carte gap-4 p-6">
      <p className="kd-titre-3 text-aubergine">D&apos;abord, installe l&apos;appli sur ton iPhone</p>
      <InstallHelp />
      <p className="kd-petit">C&apos;est indispensable pour recevoir les notifs.</p>
      <button onClick={() => setSkipped(true)} className="min-h-14 w-full text-encre-douce underline underline-offset-4">
        Continuer dans Safari quand même
      </button>
    </div>
  );
}
