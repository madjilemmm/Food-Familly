"use client";

import { useState, useTransition } from "react";
import { jePars } from "@/app/actions/trips";
import { useErreurReseau } from "@/components/ErreurReseau";
import { JeNePartsPlus } from "./DepartCourses";

/**
 * Facultatif : la liste est prête ; on prévient la famille, pour une dernière envie.
 * « compact » : le seul bouton, dans la ligne « Courses » de « Qui fait quoi ? ».
 */
export function JePars({ compact = false }: { compact?: boolean }) {
  const [pending, startTransition] = useTransition();
  const [fait, setFait] = useState(false);
  const { essayer, alerte } = useErreurReseau("Pas de réseau : la famille n'a pas été prévenue. Réessaie quand ça revient.");
  if (fait) {
    return compact ? (
      <p role="status" className="kd-petit max-w-40 text-right font-semibold">La famille est prévenue</p>
    ) : (
      <div className="mb-6">
        <p className="font-semibold">La famille est prévenue : une dernière envie peut encore arriver sur la liste.</p>
        <JeNePartsPlus />
      </div>
    );
  }
  if (compact) {
    return (
      <>
        <button
          type="button"
          disabled={pending}
          onClick={() => startTransition(async () => setFait(await essayer(() => jePars())))}
          className="kd-btn kd-btn--secondaire min-h-11 px-4"
        >
          Je pars
        </button>
        {alerte}
      </>
    );
  }
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
