"use client";

import { EcranErreur } from "@/components/EcranErreur";

/** Hors des écrans à onglets (accueil, réglages…) : la même page, dans sa colonne. */
export default function Erreur(props: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto max-w-xl px-5">
      <EcranErreur {...props} />
    </main>
  );
}
