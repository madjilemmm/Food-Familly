"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { EtatVide } from "@/components/ui";

/**
 * Un imprévu pendant l'affichage d'un écran : un message Kaddie et « Réessayer »,
 * jamais la page blanche du navigateur (« Application error »).
 */
export function EcranErreur({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();
  const [horsLigne, setHorsLigne] = useState(false);
  useEffect(() => {
    console.error(error);
    setHorsLigne(!navigator.onLine);
  }, [error]);
  return (
    <div className="pt-safe pb-6">
      <h1 className="kd-titre-1 mt-6 mb-5 text-aubergine">{horsLigne ? "Pas de réseau" : "Oups, ça a coincé"}</h1>
      <EtatVide
        phrase={
          horsLigne
            ? "Vérifie le wifi ou les données mobiles, puis réessaie. Ce qui était déjà enregistré l'est toujours."
            : "Kaddie n'a pas pu afficher cet écran. Réessaie : en général, ça repart tout de suite."
        }
      >
        <button
          type="button"
          onClick={() => {
            router.refresh();
            reset();
          }}
          className="kd-btn kd-btn--large"
        >
          Réessayer
        </button>
      </EtatVide>
    </div>
  );
}
