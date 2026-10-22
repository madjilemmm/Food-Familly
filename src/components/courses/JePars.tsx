"use client";

import { useState, useTransition } from "react";
import { jePars } from "@/app/actions/trips";
import { useErreurReseau } from "@/components/ErreurReseau";

/** Facultatif : la liste est prête ; on prévient la famille, pour une dernière envie. */
export function JePars() {
  const [pending, startTransition] = useTransition();
  const [fait, setFait] = useState(false);
  const { essayer, alerte } = useErreurReseau("Pas de réseau : la famille n'a pas été prévenue. Réessaie quand ça revient.");
  if (fait) return <p className="mb-6 font-semibold">La famille est prévenue : une dernière envie peut encore arriver sur la liste.</p>;
  return (
    <div className="mb-6">
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(async () => setFait(await essayer(() => jePars())))}
        className="kd-btn kd-btn--secondaire min-h-12 w-full"
      >
        Je pars faire les courses
      </button>
      <p className="kd-petit mt-2">Facultatif : la famille reçoit une notif pour ajouter une dernière envie.</p>
      {alerte}
    </div>
  );
}
