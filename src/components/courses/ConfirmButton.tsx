"use client";

import { useTransition } from "react";

/** Petit bouton secondaire qui demande confirmation avant d'agir. */
export function ConfirmButton({
  action,
  question,
  children,
  className = "",
}: {
  action: () => Promise<void>;
  question: string;
  children: React.ReactNode;
  className?: string;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => confirm(question) && startTransition(() => action())}
      className={`disabled:opacity-50 ${className}`}
    >
      {children}
    </button>
  );
}
