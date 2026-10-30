"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useErreurReseau } from "@/components/ErreurReseau";
import { Spinner } from "@/components/Spinner";
import { SessionExpiree } from "@/lib/reseau";

export type Commande = "ceSeraCa" | "autreIdee" | "changer" | "allergie" | "foyer" | "prevenu";

/**
 * Si l'écran ne revient pas : on le redemande, puis une dernière fois, puis on recharge la page.
 * React laisse parfois en attente une mise à jour dont les données sont arrivées très vite (le serveur a répondu, l'écran
 * reste sur l'ancien état) ; un nouveau rechargement la débloque aussitôt.
 */
const RELANCES_MS = [1000, 2500];
const RECHARGE_MS = 6000;

/**
 * Un bouton de « Ce soir » : il envoie sa commande (/api/ce-soir), attend la réponse, puis recharge l'écran.
 * L'attente est affichée sur le bouton, du tap jusqu'à l'écran à jour.
 */
export function BoutonCommande({
  commande,
  recipeId,
  n,
  raison,
  reponse,
  onAvant,
  className,
  pendingLabel = "…",
  children,
  ...aria
}: {
  commande: Commande;
  recipeId?: string;
  n?: number;
  /** « Ce sera ça » : la ligne affichée sous le plat (domain/memoire.ts), gardée avec la décision pour la mesure. */
  raison?: string;
  /** « Prévenir la famille ? » : la réponse. */
  reponse?: "oui" | "plus_tard";
  /** Au tap, avant l'envoi (ouvrir l'aperçu du message sans attendre le réseau). */
  onAvant?: () => void;
  "aria-label"?: string;
  className?: string;
  pendingLabel?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [envoi, setEnvoi] = useState(false);
  const [rechargement, recharger] = useTransition();
  const { essayer, alerte } = useErreurReseau();
  const occupe = envoi || rechargement;

  useEffect(() => {
    if (!rechargement) return;
    const timers = [...RELANCES_MS.map((ms) => setTimeout(() => router.refresh(), ms)), setTimeout(() => window.location.reload(), RECHARGE_MS)];
    return () => timers.forEach(clearTimeout);
  }, [rechargement, router]);

  return (
    <>
      <button
        type="button"
        disabled={occupe}
        className={className}
        {...aria}
        onClick={async () => {
          onAvant?.();
          setEnvoi(true);
          const ok = await essayer(async () => {
            const r = await fetch("/api/ce-soir", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ commande, recipeId, n, raison, reponse }) });
            if (r.status === 401) throw new SessionExpiree();
            if (!r.ok) throw new Error(String(r.status));
          });
          setEnvoi(false);
          if (ok) recharger(() => router.refresh());
        }}
      >
        {occupe ? (
          <>
            <Spinner />
            {pendingLabel}
          </>
        ) : (
          children
        )}
      </button>
      {alerte}
    </>
  );
}
