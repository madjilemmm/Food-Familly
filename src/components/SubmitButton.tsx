"use client";

import { useFormStatus } from "react-dom";
import { Spinner } from "./Spinner";

export function SubmitButton({
  children,
  pendingLabel = "Un instant…",
  className = "",
  disabled,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending || disabled} className={`transition-[transform,opacity] duration-150 disabled:opacity-70 ${className}`}>
      {pending ? (
        <span className="inline-flex items-center justify-center gap-2">
          <Spinner className="size-5" />
          {pendingLabel}
        </span>
      ) : (
        children
      )}
    </button>
  );
}
