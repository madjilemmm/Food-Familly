"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "motion/react";
import { Bouton, IconeJenVeux, IconePasEnvie, Logo, Scene } from "@/design-system/components/Kaddie";
import { saveTastes, skipTastes, type CardAnswer } from "@/app/actions/tastes";
import { DIETS, INGREDIENTS, compatibility, type TasteLevel } from "@/lib/domain/foods";
import { CarteGeste, PILE, type Direction } from "@/components/CarteGeste";
import { IconeCoeur, IconeCroix, MessageErreur } from "@/components/ui";
import { Spinner } from "@/components/Spinner";
import type { Style } from "@/lib/session";

type Initial = { diets: string[]; autres: string[]; cards: Record<string, "pas_fan" | "adore"> };
type Other = { name: string; done: boolean; tastes: Record<string, TasteLevel> };
type Etape = "regime" | "cartes" | "resultat";

const REPONSE: Record<Direction, CardAnswer> = { gauche: "pas_fan", droite: "ok", haut: "adore" };

/**
 * Le questionnaire de goûts, façon appli de rencontre :
 * 1. régime et allergies, 2. des cartes d'ingrédients, 3. la compatibilité avec la famille.
 */
export function Questionnaire({ style, suite, initial, others }: { style: Style; suite: string; initial: Initial; others: Other[] }) {
  const router = useRouter();
  const [etape, setEtape] = useState<Etape>("regime");
  const [diets, setDiets] = useState<string[]>(initial.diets);
  const [autres, setAutres] = useState<string[]>(initial.autres);
  const [cards, setCards] = useState<Record<string, CardAnswer>>(initial.cards);
  const [index, setIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Une carte déjà couverte par un régime coché (poisson, fruits de mer) n'est pas reposée.
  const deck = useMemo(() => INGREDIENTS.filter((f) => !diets.includes(f.key)), [diets]);

  const partir = () => {
    router.push(suite);
    router.refresh();
  };
  const enregistrer = (done: boolean, ensuite: () => void) =>
    startTransition(async () => {
      setError(null);
      const res = await saveTastes({ diets, autres, cards, done });
      if (res.error) setError(res.error);
      else ensuite();
    });
  const plusTard = () =>
    etape === "regime"
      ? startTransition(async () => {
          await skipTastes();
          partir();
        })
      : enregistrer(false, partir);

  const repondre = (key: string, r: CardAnswer) => {
    setCards((c) => ({ ...c, [key]: r }));
    if (index + 1 >= deck.length) enregistrer(true, () => setEtape("resultat"));
    else setIndex(index + 1);
  };

  return (
    <Scene
      as="main"
      duo="aubergine"
      seed={etape === "regime" ? 17 : etape === "cartes" ? 23 : 31}
      className="pb-safe flex min-h-dvh flex-col gap-5 px-5 pt-[max(env(safe-area-inset-top),1rem)]"
    >
      <header className="flex items-center justify-between pt-3">
        <Logo variante="monogramme" width={34} />
        {etape !== "resultat" && (
          <button onClick={plusTard} disabled={pending} className="min-h-14 px-2 font-semibold text-blanc underline underline-offset-4">
            Plus tard
          </button>
        )}
      </header>

      {etape === "regime" && (
        <EtapeRegime
          diets={diets}
          setDiets={setDiets}
          autres={autres}
          setAutres={setAutres}
          onNext={() => {
            setIndex(0);
            setEtape("cartes");
          }}
        />
      )}

      {etape === "cartes" && (
        <EtapeCartes
          style={style}
          deck={deck}
          index={index}
          pending={pending}
          onAnswer={repondre}
          onBack={index > 0 ? () => setIndex(index - 1) : () => setEtape("regime")}
        />
      )}

      {etape === "resultat" && <EtapeResultat others={others} mine={niveaux(diets, autres, cards)} onDone={partir} />}

      {error && <MessageErreur>{error}</MessageErreur>}
    </Scene>
  );
}

function niveaux(diets: string[], autres: string[], cards: Record<string, CardAnswer>): Record<string, TasteLevel> {
  const t: Record<string, TasteLevel> = {};
  for (const [k, v] of Object.entries(cards)) if (v !== "ok") t[k] = v;
  for (const d of diets) t[d] = "interdit";
  for (const a of autres) t[`autre:${a}`] = "interdit";
  return t;
}

// ─── 1. Régime et allergies ────────────────────────────────────────────

function EtapeRegime({
  diets,
  setDiets,
  autres,
  setAutres,
  onNext,
}: {
  diets: string[];
  setDiets: (fn: (d: string[]) => string[]) => void;
  autres: string[];
  setAutres: (fn: (a: string[]) => string[]) => void;
  onNext: () => void;
}) {
  const champ = useRef<HTMLInputElement>(null);
  const ajouter = () => {
    const v = champ.current?.value.trim() ?? "";
    if (v.length >= 2) setAutres((a) => (a.includes(v) ? a : [...a, v].slice(0, 8)));
    if (champ.current) champ.current.value = "";
  };
  const puce = (on: boolean) =>
    `inline-flex min-h-14 items-center gap-2 rounded-bouton border-[3px] px-4 font-semibold active:scale-95 ${
      on ? "border-accent bg-accent text-on-accent" : "border-blanc text-blanc"
    }`;

  return (
    <div className="kd-monte flex flex-1 flex-col gap-5">
      <div>
        <p className="kd-etiquette text-blanc">Étape 1 sur 3</p>
        <h1 className="kd-titre-2 mt-2">Ce que tu ne peux pas manger</h1>
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Régime et allergies">
        {DIETS.map((d) => {
          const on = diets.includes(d.key);
          return (
            <button
              key={d.key}
              type="button"
              aria-pressed={on}
              onClick={() => setDiets((ds) => (on ? ds.filter((k) => k !== d.key) : [...ds, d.key]))}
              className={puce(on)}
            >
              {d.label}
            </button>
          );
        })}
        {autres.map((a) => (
          <button
            key={a}
            type="button"
            aria-label={`Retirer ${a}`}
            onClick={() => setAutres((as) => as.filter((x) => x !== a))}
            className={puce(true)}
          >
            {a} <IconeCroix className="size-5" />
          </button>
        ))}
      </div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          ajouter();
        }}
      >
        <input ref={champ} aria-label="Autre" placeholder="Autre : céleri, kiwi…" maxLength={40} className="kd-champ min-w-0 flex-1" />
        <button type="submit" className="kd-btn kd-btn--secondaire shrink-0 px-4">
          Ajouter
        </button>
      </form>
      <p className="kd-petit text-blanc">
        Visible seulement par ta famille. Sert uniquement à trier les recettes. Pour une allergie, vérifie toujours les étiquettes.
      </p>
      <div className="mt-auto pb-4">
        <Bouton variante="secondaire" large onClick={onNext}>
          {diets.length + autres.length ? "Suivant" : "Rien de tout ça"}
        </Bouton>
      </div>
    </div>
  );
}

// ─── 2. Les cartes d'ingrédients ───────────────────────────────────────

function EtapeCartes({
  style,
  deck,
  index,
  pending,
  onAnswer,
  onBack,
}: {
  style: Style;
  deck: { key: string; label: string }[];
  index: number;
  pending: boolean;
  onAnswer: (key: string, r: CardAnswer) => void;
  onBack: () => void;
}) {
  const pileRef = useRef<HTMLDivElement>(null);
  const lancer = useRef<((d: Direction) => void) | null>(null);
  const courant = deck[index];
  const appuyer = (d: Direction) => (lancer.current ? lancer.current(d) : courant && onAnswer(courant.key, REPONSE[d]));

  return (
    <div className="flex flex-1 flex-col gap-5">
      <div>
        <p className="kd-etiquette text-blanc">
          Étape 2 sur 3 · carte {Math.min(index + 1, deck.length)} sur {deck.length}
        </p>
        <h1 className="kd-titre-2 mt-2">Et ça, tu aimes&nbsp;?</h1>
      </div>

      {style === "fun" ? (
        <>
          <div ref={pileRef} className="relative min-h-[14rem] flex-1">
            <AnimatePresence initial={false}>
              {deck
                .slice(index, index + PILE.length)
                .map((f, i) => (
                  <CarteGeste
                    key={f.key}
                    rang={i}
                    pileRef={pileRef}
                    haut
                    onDecide={(d) => onAnswer(f.key, REPONSE[d])}
                    register={i === 0 ? (fn) => (lancer.current = fn) : undefined}
                    tampons={{
                      gauche: <span className="kd-tampon kd-tampon--nope">J&apos;aime pas</span>,
                      droite: <span className="kd-tampon kd-tampon--like">Ça me va</span>,
                      // En bas de la carte : elle part vers le haut, le tampon reste visible.
                      haut: <span className="kd-tampon top-auto bottom-6 left-1/2 -translate-x-1/2 bg-aubergine text-blanc">J&apos;adore</span>,
                    }}
                  >
                    <NomCarte label={f.label} />
                  </CarteGeste>
                ))
                .reverse()}
            </AnimatePresence>
          </div>
          <p className="kd-petit text-center text-blanc">Gauche : j&apos;aime pas · droite : ça me va · haut : j&apos;adore</p>
          <div className="flex items-center justify-center gap-6">
            <Bouton variante="nope" rond aria-label="J'aime pas" disabled={pending} onClick={() => appuyer("gauche")}>
              <IconePasEnvie />
            </Bouton>
            <Bouton variante="secondaire" rond aria-label="Ça me va" disabled={pending} onClick={() => appuyer("droite")}>
              <IconeJenVeux />
            </Bouton>
            <Bouton variante="like" rond aria-label="J'adore" disabled={pending} onClick={() => appuyer("haut")}>
              <IconeCoeur className="size-8" />
            </Bouton>
          </div>
        </>
      ) : (
        courant && (
          <div className="flex flex-1 flex-col gap-3">
            <div key={courant.key} className="kd-monte flex min-h-40 flex-1">
              <NomCarte label={courant.label} className="flex-1" />
            </div>
            {(
              [
                ["pas_fan", "J'aime pas", "kd-btn--nope"],
                ["ok", "Ça me va", "kd-btn--secondaire"],
                ["adore", "J'adore", "kd-btn--like"],
              ] as const
            ).map(([r, label, variante]) => (
              <button
                key={r}
                disabled={pending}
                onClick={() => onAnswer(courant.key, r)}
                className={`kd-btn kd-btn--large ${variante} min-h-20 text-titre-3`}
              >
                {label}
              </button>
            ))}
          </div>
        )
      )}

      <div className="flex items-center justify-between pb-4">
        <button onClick={onBack} disabled={pending} className="min-h-14 px-1 text-blanc underline underline-offset-4">
          {index > 0 ? "Carte d'avant" : "Retour"}
        </button>
        {pending && <Spinner className="w-7 text-blanc" />}
      </div>
    </div>
  );
}

function NomCarte({ label, className = "h-full" }: { label: string; className?: string }) {
  return (
    // Motif de fruits et légumes en fond (lilas pâle), le nom posé sur une étiquette blanche.
    <article
      className={`kd-carte items-center justify-center bg-[url(/brand/fonds/kaddie-motif-legumes-lilas.webp)] bg-cover bg-center p-6 text-center ${className}`}
    >
      <p className="kd-titre-1 rounded-carte bg-blanc px-5 py-3 text-aubergine">{label}</p>
    </article>
  );
}

// ─── 3. La compatibilité ───────────────────────────────────────────────

function EtapeResultat({ others, mine, onDone }: { others: Other[]; mine: Record<string, TasteLevel>; onDone: () => void }) {
  return (
    <div className="kd-monte flex flex-1 flex-col gap-5">
      <div>
        <p className="kd-etiquette text-blanc">Étape 3 sur 3</p>
        <h1 className="kd-titre-1 mt-2">C&apos;est noté.</h1>
        <p className="mt-2">Le swipe de toute la famille en tient compte dès maintenant.</p>
      </div>
      {others.length > 0 && (
        <ul className="flex flex-col gap-3">
          {others.map((o) => (
            <li key={o.name} className="kd-carte gap-1 p-5">
              {o.done ? (
                <>
                  <p className="kd-etiquette">Toi et {o.name}</p>
                  <p className="kd-titre-2 text-aubergine">{compatibility(mine, o.tastes)}&nbsp;% compatibles</p>
                </>
              ) : (
                <p className="font-display text-titre-3 text-aubergine">{o.name} n&apos;a pas encore répondu</p>
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-auto pb-4">
        <Bouton variante="geant" onClick={onDone}>
          C&apos;est parti
        </Bouton>
      </div>
    </div>
  );
}
