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
    <div className="rounded-3xl bg-white p-6 shadow-md">
      <p className="mb-4 text-xl font-bold">📲 D&apos;abord, installez l&apos;appli sur votre iPhone :</p>
      <div className="text-lg">
        <InstallHelp />
      </div>
      <p className="mt-4 text-stone-500">C&apos;est indispensable pour recevoir les notifications.</p>
      <button onClick={() => setSkipped(true)} className="mt-5 w-full py-2 text-stone-400 underline">
        Continuer dans Safari quand même
      </button>
    </div>
  );
}
