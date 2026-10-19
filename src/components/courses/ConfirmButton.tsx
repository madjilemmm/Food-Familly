"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { Spinner } from "@/components/Spinner";
import { messageErreur } from "@/lib/reseau";

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
  apres,
  "aria-label": ariaLabel,
}: {
  action: () => Promise<unknown> | unknown;
  question: string;
  detail?: string;
  confirmLabel?: string;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  /** Une fois l'action faite, ouvre cette adresse (rechargement franc : l'écran suit à coup sûr). */
  apres?: string;
  "aria-label"?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  // Sans réseau, la feuille reste ouverte avec un message : on peut réessayer ou annuler.
  const [erreur, setErreur] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        disabled={disabled || pending}
        onClick={() => {
          setErreur(null);
          setOpen(true);
        }}
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
        erreur={erreur}
        onCancel={() => setOpen(false)}
        onConfirm={() =>
          startTransition(async () => {
            setErreur(null);
            try {
              await action();
            } catch (e) {
              setErreur(messageErreur(e));
              return;
            }
            if (apres) window.location.assign(apres);
            else setOpen(false);
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
  erreur,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  question: string;
  detail?: string;
  confirmLabel: string;
  pending: boolean;
  erreur?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [monte, setMonte] = useState(false);
  // Reste affichée le temps de l'animation de fermeture (CSS, sans bibliothèque).
  const [rendue, setRendue] = useState(open);
  const annuler = useRef<HTMLButtonElement>(null);
  const confirmer = useRef<HTMLButtonElement>(null);
  const avant = useRef<HTMLElement | null>(null);
  useEffect(() => setMonte(true), []);
  useEffect(() => {
    if (open) {
      setRendue(true);
      return;
    }
    const t = setTimeout(() => setRendue(false), 180);
    return () => clearTimeout(t);
  }, [open]);
  // Valeurs du moment, lues par le clavier sans relancer l'effet à chaque rendu.
  const etat = useRef({ pending, onCancel });
  etat.current = { pending, onCancel };
  useEffect(() => {
    if (!open) return;
    // Le focus va sur « Annuler » ; il revient au bouton d'origine à la fermeture.
    avant.current = document.activeElement as HTMLElement | null;
    annuler.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !etat.current.pending) etat.current.onCancel();
      // Tab reste dans la feuille : on passe d'un bouton à l'autre.
      if (e.key === "Tab") {
        e.preventDefault();
        (document.activeElement === annuler.current ? confirmer : annuler).current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (avant.current?.isConnected) avant.current.focus();
    };
  }, [open]);

  // Affichée dès l'ouverture (le focus peut s'y poser tout de suite), puis le temps de sa sortie.
  if (!monte || !(open || rendue)) return null;
  return createPortal(
    <div
      data-ferme={open ? undefined : ""}
      className="feuille-fond fixed inset-0 z-[60] flex items-end justify-center bg-encre/60"
      onClick={() => !pending && onCancel()}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-titre"
        aria-describedby={detail ? "confirm-detail" : undefined}
        className="feuille pb-safe w-full max-w-xl rounded-t-carte bg-surface px-5 pt-6"
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
        {erreur && (
          <p role="alert" className="mt-4 rounded-pastille border-[3px] border-aubergine bg-surface px-4 py-3 text-encre">
            {erreur}
          </p>
        )}
        <div className="mt-6 flex flex-col gap-3 pb-4">
          <button ref={confirmer} type="button" onClick={onConfirm} disabled={pending} className="kd-btn kd-btn--large">
            {pending ? <Spinner /> : confirmLabel}
          </button>
          <button ref={annuler} type="button" onClick={onCancel} disabled={pending} className="kd-btn kd-btn--secondaire kd-btn--large">
            Annuler
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
