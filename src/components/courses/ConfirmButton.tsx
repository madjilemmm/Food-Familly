"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { Spinner } from "@/components/Spinner";

/**
 * Bouton qui demande confirmation avant d'agir, dans une feuille Kaddie qui
 * monte du bas (au lieu de la fenêtre grise du système). « Annuler » est
 * sélectionné par défaut ; Échap ou un appui à côté referment la feuille.
 */
export function ConfirmButton({
  action,
  question,
  detail,
  confirmLabel = "Oui",
  children,
  className = "",
  disabled,
  "aria-label": ariaLabel,
}: {
  action: () => Promise<unknown> | unknown;
  question: string;
  detail?: string;
  confirmLabel?: string;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  "aria-label"?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  return (
    <>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        disabled={disabled || pending}
        onClick={() => setOpen(true)}
        className={`disabled:opacity-50 ${className}`}
      >
        {children}
      </button>
      <ConfirmSheet
        open={open}
        question={question}
        detail={detail}
        confirmLabel={confirmLabel}
        pending={pending}
        onCancel={() => setOpen(false)}
        onConfirm={() =>
          startTransition(async () => {
            await action();
            setOpen(false);
          })
        }
      />
    </>
  );
}

export function ConfirmSheet({
  open,
  question,
  detail,
  confirmLabel,
  pending,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  question: string;
  detail?: string;
  confirmLabel: string;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [monte, setMonte] = useState(false);
  const annuler = useRef<HTMLButtonElement>(null);
  useEffect(() => setMonte(true), []);
  useEffect(() => {
    if (!open) return;
    annuler.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !pending && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, pending, onCancel]);

  if (!monte) return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="fond"
          className="fixed inset-0 z-[60] flex items-end justify-center bg-encre/60"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={() => !pending && onCancel()}
        >
          <motion.div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-titre"
            aria-describedby={detail ? "confirm-detail" : undefined}
            className="pb-safe w-full max-w-xl rounded-t-carte bg-surface px-5 pt-6"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            <p id="confirm-titre" className="kd-titre-2 text-aubergine">
              {question}
            </p>
            {detail && (
              <p id="confirm-detail" className="mt-2 text-encre-douce">
                {detail}
              </p>
            )}
            <div className="mt-6 flex flex-col gap-3 pb-4">
              <button type="button" onClick={onConfirm} disabled={pending} className="kd-btn kd-btn--large">
                {pending ? <Spinner /> : confirmLabel}
              </button>
              <button ref={annuler} type="button" onClick={onCancel} disabled={pending} className="kd-btn kd-btn--secondaire kd-btn--large">
                Annuler
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
