"use client";

import { useEffect, useOptimistic, useState, useTransition } from "react";
import { annulerATable, appelerATable, repondreATable } from "@/app/actions/a-table";
import { useErreurReseau } from "@/components/ErreurReseau";
import type { ATable } from "@/lib/data";

const pastille = "flex min-h-12 flex-1 items-center justify-center rounded-bouton border-[3px] px-3 font-semibold active:scale-95";
const pastilleDe = (choisie = false) => `${pastille} ${choisie ? "border-aubergine bg-accent text-on-accent" : "border-trait bg-surface text-encre"}`;

/**
 * « Appeler à table » : la personne qui cuisine prévient tout le monde, maintenant
 * ou dans quelques minutes. Les autres reçoivent une notification et répondent.
 */
export function AppelerATable({ titre, large = false }: { titre?: string; large?: boolean }) {
  const [ouvert, setOuvert] = useState(false);
  const [envoye, setEnvoye] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();
  const { essayer, alerte } = useErreurReseau("Pas de réseau : l'appel n'est pas parti. Réessaie quand ça revient.");
  const appeler = (minutes: number) =>
    startTransition(async () => {
      if (await essayer(() => appelerATable(minutes, titre))) setEnvoye(minutes);
    });

  if (envoye != null) {
    return (
      <p role="status" className="kd-carte p-4 text-center font-semibold">
        {envoye ? `C'est envoyé : à table dans ${envoye} min.` : "C'est envoyé : à table !"}
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {ouvert ? (
        <>
          <p className="font-semibold">On passe à table…</p>
          <div className="flex gap-2">
            {[0, 10, 20, 30].map((m) => (
              <button key={m} type="button" disabled={pending} onClick={() => appeler(m)} className={pastilleDe()}>
                {m ? `${m} min` : "Maintenant"}
              </button>
            ))}
          </div>
        </>
      ) : (
        <button type="button" onClick={() => setOuvert(true)} className={`kd-btn kd-btn--secondaire ${large ? "kd-btn--large" : "min-h-12 px-5"}`}>
          Appeler à table
        </button>
      )}
      {alerte}
    </div>
  );
}

/** Minutes restantes (arrondies au-dessus), 0 quand c'est l'heure. */
/**
 * Au dernier minuteur de la recette : « À table dans 5 min », un appui, la famille est prévenue.
 * Facultatif : rien ne part sans appui.
 */
export function PropositionATable({ titre }: { titre: string }) {
  const [envoye, setEnvoye] = useState(false);
  const [pending, startTransition] = useTransition();
  const { essayer, alerte } = useErreurReseau("Pas de réseau : l'appel n'est pas parti. Réessaie quand ça revient.");
  if (envoye) return <p role="status" className="font-semibold">La famille est prévenue : à table dans 5 min.</p>;
  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(async () => setEnvoye(await essayer(() => appelerATable(5, titre))))}
        className="kd-btn kd-btn--secondaire self-start px-6"
      >
        À table dans 5 min
      </button>
      {alerte}
    </>
  );
}

function restant(a: number, now: number) {
  return Math.max(0, Math.ceil((a - now) / 60_000));
}

/**
 * Le bandeau « À table ! », en haut de l'écran tant que l'appel est en cours :
 * le compte à rebours, et « J'arrive » / « 5 min » (ou, pour qui cuisine, les réponses).
 */
export function BandeauATable({ appel, moi }: { appel: ATable; moi: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);
  const [, startTransition] = useTransition();
  const { essayer, alerte } = useErreurReseau();
  const [maReponse, repondre] = useOptimistic(appel.reponses.find((r) => r.id === moi)?.reponse ?? null, (_, r: "arrive" | "retard") => r);
  const [cache, setCache] = useState(false);
  if (cache || now > appel.a + 20 * 60_000) return null;

  const min = restant(appel.a, now);
  const titre = min ? `À table dans ${min} min` : "À table !";
  const cuisine = appel.cuisinier?.id === moi;
  const repondu = (r: "arrive" | "retard") =>
    startTransition(async () => {
      repondre(r);
      await essayer(() => repondreATable(appel.id, r));
    });

  return (
    <div className="pt-safe fixed inset-x-0 top-0 z-40 px-4">
      <section
        aria-live="polite"
        className="kd-monte mx-auto mt-2 flex max-w-xl flex-col gap-3 rounded-carte border-[3px] border-aubergine bg-surface p-4 shadow-lg"
      >
        <div className="flex items-baseline justify-between gap-3">
          <p className="kd-titre-2 text-aubergine">{titre}</p>
          <button type="button" onClick={() => setCache(true)} className="min-h-11 shrink-0 font-semibold text-violet underline underline-offset-4">
            Fermer
          </button>
        </div>
        {cuisine ? (
          <>
            <p className="text-encre-douce">
              {appel.reponses.length
                ? appel.reponses.map((r) => `${r.name} ${r.reponse === "arrive" ? "arrive" : ": 5 min"}`).join(" · ")
                : "Personne n'a encore répondu."}
            </p>
            <button
              type="button"
              onClick={() => startTransition(async () => void (await essayer(() => annulerATable(appel.id))))}
              className="min-h-11 self-start font-semibold text-encre-douce underline underline-offset-4"
            >
              Annuler l&apos;appel
            </button>
          </>
        ) : (
          <>
            <p className="text-encre-douce">
              {appel.cuisinier?.name ?? "Quelqu'un"} a cuisiné
              {appel.titre ? ` : ${appel.titre}` : ""}.
            </p>
            <div className="flex gap-2">
              <button type="button" aria-pressed={maReponse === "arrive"} onClick={() => repondu("arrive")} className={pastilleDe(maReponse === "arrive")}>
                J&apos;arrive
              </button>
              <button type="button" aria-pressed={maReponse === "retard"} onClick={() => repondu("retard")} className={pastilleDe(maReponse === "retard")}>
                5 min
              </button>
            </div>
          </>
        )}
      </section>
      {alerte}
    </div>
  );
}
