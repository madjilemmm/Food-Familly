"use client";

import { useEffect, useRef, useState } from "react";
import { useFeuille } from "@/lib/useFeuille";
import { createPortal } from "react-dom";
import { IconeCroix } from "@/components/ui";
import { Spinner } from "@/components/Spinner";
import { invitationAuPlat } from "@/lib/domain/apercu";

/** Le signal qui ouvre l'aperçu du message : « Prévenir » de la question qui suit « Ce sera ça » le lance. */
export const EVENEMENT_PREVENIR = "kaddie:prevenir";

/**
 * « Prévenir la famille » : un bouton à côté de « Décidé » (ou « Prévenir » de la question qui suit « Ce sera ça ») ouvre l'aperçu du
 * message (le plat, la liste déjà prête, et qui en avait envie), « Envoyer » ouvre le partage du téléphone avec le lien d'invitation.
 * Rien à rédiger, rien à expliquer.
 */
export function PartagerRepas({ titre, articles, photo, commeVoulu = null }: { titre: string; articles: number; photo: string | null; commeVoulu?: string | null }) {
  const [ouvert, setOuvert] = useState(false);
  const [monte, setMonte] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const fermer = useRef<HTMLButtonElement>(null);
  const bouton = useRef<HTMLButtonElement>(null);
  useEffect(() => setMonte(true), []);
  useEffect(() => {
    const ouvrir = () => {
      setInfo(null);
      setOuvert(true);
    };
    window.addEventListener(EVENEMENT_PREVENIR, ouvrir);
    return () => window.removeEventListener(EVENEMENT_PREVENIR, ouvrir);
  }, []);
  // Focus dans la fenêtre, Tab qui y reste, Échap qui ferme, focus rendu au bouton « Prévenir ».
  useFeuille({
    actif: ouvert,
    onClose: () => setOuvert(false),
    racine: () => document.querySelector<HTMLElement>("[aria-labelledby=partager-titre]"),
    premier: () => fermer.current,
    retour: () => bouton.current,
  });

  // Le message tel que la famille le lira, puis le lien (ou l'adresse et le code, si les liens ne sont pas prêts).
  const entete = `Ce soir : ${titre}${commeVoulu ? `, ${commeVoulu}` : ""}`;
  const phrase = `${entete}. ${invitationAuPlat(articles)}`;

  async function envoyer() {
    setEnvoi(true);
    setInfo(null);
    try {
      const r = await fetch("/api/invitation", { method: "POST" });
      if (!r.ok) throw new Error(String(r.status));
      const { lien, code, origine } = (await r.json()) as { lien: string | null; code: string | null; origine: string };
      const url = lien ?? origine;
      const texte = lien ? phrase : `${phrase} ${origine}${code ? ` (code famille : ${code})` : ""}`;
      try {
        if (navigator.share) {
          await navigator.share(lien ? { title: "Kaddie", text: phrase, url } : { title: "Kaddie", text: texte });
          setOuvert(false);
          return;
        }
      } catch {
        return; // partage annulé
      }
      await navigator.clipboard?.writeText(lien ? `${phrase} ${url}` : texte).catch(() => {});
      setInfo("Message copié : colle-le dans le groupe de la famille.");
    } catch {
      setInfo("Pas de réseau : le message n'est pas parti. Réessaie quand ça revient.");
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <>
      <button
        ref={bouton}
        type="button"
        aria-label="Prévenir la famille"
        aria-haspopup="dialog"
        onClick={() => {
          setInfo(null);
          setOuvert(true);
        }}
        className="ml-auto flex size-10 shrink-0 items-center justify-center rounded-full border-[3px] border-aubergine bg-blanc text-aubergine active:scale-95"
      >
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 15V4M8 8l4-4 4 4" />
          <path d="M5 12v7h14v-7" />
        </svg>
      </button>
      {monte &&
        ouvert &&
        createPortal(
          <div className="feuille-fond fixed inset-0 z-[60] flex items-end justify-center bg-encre/60" onClick={() => !envoi && setOuvert(false)}>
            <div role="dialog" aria-modal="true" aria-labelledby="partager-titre" className="feuille pb-safe w-full max-w-xl rounded-t-carte bg-surface px-5 pt-6" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-start justify-between gap-4">
                <p id="partager-titre" className="kd-titre-2 text-aubergine">
                  Prévenir la famille
                </p>
                <button ref={fermer} type="button" aria-label="Fermer" onClick={() => setOuvert(false)} className="flex size-11 shrink-0 items-center justify-center rounded-full text-encre-douce active:scale-95">
                  <IconeCroix className="size-6" />
                </button>
              </div>
              <div className="mt-4 overflow-hidden rounded-carte border-2 border-trait bg-fond">
                {/* eslint-disable-next-line @next/next/no-img-element -- photo Supabase, aperçu seulement */}
                {photo ? <img src={photo} alt="" className="h-32 w-full object-cover" /> : <div aria-hidden className="photo-absente h-32 w-full" />}
                <div className="px-4 py-3">
                  <p className="font-semibold">{entete}</p>
                  <p className="kd-petit">{invitationAuPlat(articles)}</p>
                </div>
              </div>
              {info && (
                <p role="status" className="kd-petit mt-3 font-semibold text-aubergine">
                  {info}
                </p>
              )}
              <div className="flex flex-col gap-1 pt-4 pb-4">
                <button type="button" disabled={envoi} onClick={envoyer} className="kd-btn kd-btn--large w-full">
                  {envoi ? (
                    <>
                      <Spinner />
                      Un instant…
                    </>
                  ) : (
                    "Envoyer"
                  )}
                </button>
                <button type="button" onClick={() => setOuvert(false)} className="min-h-12 font-semibold text-violet">
                  Plus tard
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
