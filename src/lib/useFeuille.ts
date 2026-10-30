import { useEffect } from "react";

const FOCALISABLES = 'a[href], button:not([disabled]), input:not([disabled]):not([type=hidden]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Le comportement commun des fenêtres modales (Je cuisine, Prévenir la famille) : le focus entre dans la fenêtre, Tab y reste,
 * Échap la ferme, et le focus revient là où l'on était. (« Confirmer » de la liste de courses fait de même, avec sa propre logique.)
 * `racine` : la fenêtre ; `premier` : l'élément qui prend le focus (sinon le premier focalisable) ; `retour` : où le focus revient (sinon l'élément actif avant l'ouverture).
 */
export function useFeuille({
  actif,
  onClose,
  racine,
  premier,
  retour,
}: {
  actif: boolean;
  onClose: () => void;
  racine: () => HTMLElement | null;
  premier?: () => HTMLElement | null;
  retour?: () => HTMLElement | null;
}) {
  useEffect(() => {
    if (!actif) return;
    const avant = document.activeElement as HTMLElement | null;
    const liste = () => [...(racine()?.querySelectorAll<HTMLElement>(FOCALISABLES) ?? [])].filter((e) => e.offsetParent !== null || e === document.activeElement);
    (premier?.() ?? liste()[0])?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return onClose();
      if (e.key !== "Tab") return;
      const els = liste();
      if (els.length === 0) return;
      const debut = els[0];
      const fin = els[els.length - 1];
      const dedans = racine()?.contains(document.activeElement);
      if (e.shiftKey && (document.activeElement === debut || !dedans)) {
        e.preventDefault();
        fin.focus();
      } else if (!e.shiftKey && (document.activeElement === fin || !dedans)) {
        e.preventDefault();
        debut.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      const cible = retour?.() ?? avant;
      if (cible?.isConnected) cible.focus();
    };
    // Une seule installation par ouverture : les fonctions passées lisent l'état courant à l'appel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actif]);
}
