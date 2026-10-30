"use client";

import { useFormStatus } from "react-dom";
import { Spinner } from "./Spinner";

/** Bouton d'envoi de formulaire, aux classes du kit (kd-btn…). */
export function SubmitButton({
  children,
  pendingLabel = "Un instant…",
  className = "kd-btn kd-btn--large",
  disabled,
  name,
  value,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
  disabled?: boolean;
  /** Envoyé avec le formulaire (deux boutons d'envoi qui n'ont pas le même sens). */
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" name={name} value={value} disabled={pending || disabled} className={className}>
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
