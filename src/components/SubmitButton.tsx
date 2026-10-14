"use client";

import { useFormStatus } from "react-dom";
import { Spinner } from "./Spinner";

/** Bouton d'envoi de formulaire, aux classes du kit (kd-btn…). */
export function SubmitButton({
  children,
  pendingLabel = "Un instant…",
  className = "kd-btn kd-btn--large",
  disabled,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending || disabled} className={className}>
      {pending ? (
        <>
          <Spinner />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
}
