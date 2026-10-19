"use client";

import { useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { setTripRecipe, setTripRecipeEaters } from "@/app/actions/trips";
import { RecipeVisual } from "@/components/RecipeVisual";
import { IconePlus } from "@/components/ui";
import { listeDeNoms } from "@/lib/domain/convives";
import { useErreurReseau } from "@/components/ErreurReseau";
import type { CandidateRecipe } from "@/lib/views";

type Membre = { id: string; name: string };
type Changement = { id: string; checked?: boolean; eaters?: string[]; n?: number };

/** Pourquoi le plat est là, en clair : « Demandé par Madji », « Envie de Madji et Yoalem », « Tu aimes ce plat ». */
function raisonEnClair(r: CandidateRecipe["raison"], noms: Map<string, string>, moi: Membre): string {
  const qui = r.qui.flatMap((id) => noms.get(id) ?? []);
  const seulMoi = r.qui.length === 1 && r.qui[0] === moi.id;
  // « Envie de toi et Madji » : seul « Toi » passe en minuscule, jamais un prénom.
  const liste = () => listeDeNoms(qui, moi.name).replace(/^Toi\b/, "toi");
  switch (r.type) {
    case "demande":
      return `Demandé par ${listeDeNoms(qui)}`;
    case "envie":
      return seulMoi ? "Ton envie" : `Envie de ${liste()}`;
    case "aime":
      return seulMoi ? "Tu aimes ce plat" : `Aimé de ${liste()}`;
    default:
      return "Pour toute la famille";
  }
}

/**
 * « Kaddie te propose » : les plats déjà retenus (demandés, ou envie de plusieurs),
 * avec pourquoi. On retire d'un appui ; le reste attend, replié, dans « Autres idées ».
 * Qui mange se corrige si besoin : c'est le repas réel, pas qui aime le plat d'habitude.
 */
export function RecipeChecklist({ recipes, moi, membres }: { recipes: CandidateRecipe[]; moi: Membre; membres: Membre[] }) {
  const [, startTransition] = useTransition();
  const [optimistic, apply] = useOptimistic(recipes, (state, c: Changement) =>
    state.map((r) =>
      r.id === c.id
        ? {
            ...r,
            checked: c.checked ?? r.checked,
            eaters: c.eaters ?? r.eaters,
            convives: c.n ? { ...r.convives, n: c.n, corrige: true } : r.convives,
          }
        : r,
    ),
  );
  const noms = new Map(membres.map((m) => [m.id, m.name]));
  const { essayer, alerte } = useErreurReseau();
  const garder = (id: string, checked: boolean) =>
    startTransition(async () => {
      apply({ id, checked });
      await essayer(() => setTripRecipe(id, checked));
    });
  const manger = (id: string, eaters: string[], invites: number) =>
    startTransition(async () => {
      apply({ id, eaters, n: eaters.length + invites });
      await essayer(() => setTripRecipeEaters(id, eaters, invites));
    });

  const retenus = optimistic.filter((r) => r.checked);
  const autres = optimistic.filter((r) => !r.checked);
  const ligne = (r: CandidateRecipe) => (
    <Plat key={r.id} r={r} raison={raisonEnClair(r.raison, noms, moi)} membres={membres} onGarder={garder} onManger={manger} />
  );
  return (
    <>
      {retenus.length > 0 ? (
        <ul className="kd-liste">{retenus.map(ligne)}</ul>
      ) : (
        <p className="text-encre-douce">
          {autres.length > 0
            ? "Rien de retenu pour l'instant : pioche dans les idées ci-dessous, ou fais ta liste quand même."
            : "Personne n'a encore rien demandé. Tu peux faire ta liste quand même et y ajouter des articles."}
        </p>
      )}
      {autres.length > 0 && (
        <details className="group mt-4">
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between font-semibold text-violet">
            Autres idées ({autres.length})
            <IconePlus className="size-5 transition-transform group-open:rotate-45" />
          </summary>
          <ul className="kd-liste">{autres.map(ligne)}</ul>
        </details>
      )}
      {alerte}
    </>
  );
}

function Plat({
  r,
  raison,
  membres,
  onGarder,
  onManger,
}: {
  r: CandidateRecipe;
  raison: string;
  membres: Membre[];
  onGarder: (id: string, checked: boolean) => void;
  onManger: (id: string, eaters: string[], invites: number) => void;
}) {
  const [reglage, setReglage] = useState(false);
  const n = r.convives.n;
  const invites = Math.max(0, n - r.eaters.length);
  const rond =
    "flex size-11 shrink-0 items-center justify-center rounded-full border-[3px] border-aubergine text-aubergine active:scale-95 disabled:opacity-30";
  return (
    <li className="border-b-2 border-trait py-2">
      <div className="flex items-center gap-3">
        <Link href={`/recettes/${r.id}?depuis=/courses`} aria-label={`La recette : ${r.title}`} className="shrink-0 active:scale-95">
          <RecipeVisual recipe={r} taille="vignette" className="size-14 rounded-pastille" />
        </Link>
        <button
          type="button"
          aria-pressed={r.checked}
          aria-label={`Garder ${r.title}`}
          onClick={() => onGarder(r.id, !r.checked)}
          className="flex min-h-14 min-w-0 flex-1 items-center gap-3 text-left"
        >
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">{r.title}</span>
            {!r.checked && <span className="kd-petit block">{raison}</span>}
            {r.attention && <span className="kd-petit block font-semibold text-violet">{r.attention}</span>}
          </span>
          <span
            aria-hidden
            className={`grid size-7 shrink-0 place-content-center rounded-pastille border-[3px] border-aubergine transition-[background-color,transform] duration-200 ease-rebond ${
              r.checked ? "scale-108 bg-accent text-on-accent" : "bg-surface"
            }`}
          >
            {r.checked && (
              <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
                <path fill="none" stroke="currentColor" strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.5l5 5L19.5 7" />
              </svg>
            )}
          </span>
        </button>
      </div>
      {/* Plat gardé : pourquoi, pour combien ; un appui pour dire qui le mange vraiment. */}
      {r.checked && !reglage && (
        <button type="button" onClick={() => setReglage(true)} className="kd-petit flex min-h-11 items-center pl-[4.25rem] text-left">
          {raison} · pour {n}&nbsp;<span className="text-violet underline underline-offset-4">changer</span>
        </button>
      )}
      {r.checked && reglage && (
        <div className="flex flex-col gap-3 pt-2 pl-[4.25rem]">
          <p className="kd-etiquette">Qui en mange ?</p>
          <div className="flex flex-wrap gap-2">
            {membres.map((m) => {
              const mange = r.eaters.includes(m.id);
              const suivants = mange ? r.eaters.filter((id) => id !== m.id) : [...r.eaters, m.id];
              return (
                <button
                  key={m.id}
                  type="button"
                  aria-pressed={mange}
                  disabled={mange && suivants.length + invites < 1}
                  onClick={() => onManger(r.id, suivants, invites)}
                  className={`min-h-11 rounded-bouton border-[3px] px-3 font-semibold ${
                    mange ? "border-aubergine bg-accent text-on-accent" : "border-trait text-encre-douce"
                  }`}
                >
                  {m.name}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-3">
            <span className="flex-1 font-semibold">
              {invites === 0 ? "Pas d'invité" : `${invites} invité${invites > 1 ? "s" : ""}`}
            </span>
            <button type="button" aria-label={`Un invité de moins pour ${r.title}`} onClick={() => onManger(r.id, r.eaters, invites - 1)} disabled={invites < 1 || (invites === 1 && r.eaters.length === 0)} className={rond}>
              <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
                <path d="M5 12h14" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" />
              </svg>
            </button>
            <button type="button" aria-label={`Un invité de plus pour ${r.title}`} onClick={() => onManger(r.id, r.eaters, invites + 1)} disabled={invites >= 20} className={rond}>
              <IconePlus className="size-5" />
            </button>
          </div>
          <button type="button" onClick={() => setReglage(false)} className="self-start min-h-11 font-semibold text-violet underline underline-offset-4">
            C&apos;est bon · pour {n}
          </button>
        </div>
      )}
    </li>
  );
}
