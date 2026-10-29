"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useErreurReseau } from "@/components/ErreurReseau";
import { Spinner } from "@/components/Spinner";

export type Commande = "ceSeraCa" | "autreIdee" | "changer" | "allergie" | "foyer";

/**
 * Un bouton de « Ce soir » : il envoie sa commande (/api/ce-soir), attend la réponse, puis recharge l'écran.
 * L'attente est affichée sur le bouton, du tap jusqu'à l'écran à jour.
 */
export function BoutonCommande({
  commande,
  recipeId,
  n,
  className,
  pendingLabel = "…",
  children,
  ...aria
}: {
  commande: Commande;
  recipeId?: string;
  n?: number;
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

  return (
    <>
      <button
        type="button"
        disabled={occupe}
        className={className}
        {...aria}
        onClick={async () => {
          setEnvoi(true);
          const ok = await essayer(async () => {
            const r = await fetch("/api/ce-soir", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ commande, recipeId, n }) });
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
