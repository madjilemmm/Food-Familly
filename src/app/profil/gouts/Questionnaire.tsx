"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "motion/react";
import { Bouton, IconeJenVeux, IconePasEnvie, Logo, Scene } from "@/design-system/components/Kaddie";
import { saveTastes, skipTastes, type CardAnswer } from "@/app/actions/tastes";
import { CARTES_AJOUTEES, DIETS, cartesPour, compatibility, type TasteLevel } from "@/lib/domain/foods";
import { STYLES, type Envies, type Piquant, type Temps } from "@/lib/domain/envies";
import { CarteGeste, PILE, type Direction } from "@/components/CarteGeste";
import { IconeCoeur, IconeCroix, MessageErreur } from "@/components/ui";
import { Spinner } from "@/components/Spinner";
import type { Style } from "@/lib/session";

type Initial = { diets: string[]; autres: string[]; cards: Record<string, "pas_fan" | "adore"> };
type Other = { name: string; done: boolean; tastes: Record<string, TasteLevel> };
type Etape = "regime" | "envies" | "cartes" | "resultat";

const REPONSE: Record<Direction, CardAnswer> = { gauche: "pas_fan", droite: "ok", haut: "adore" };

/**
 * Le questionnaire de goûts, façon appli de rencontre :
 * 1. régime et allergies, 2. tes envies (styles, temps, piquant), 3. des cartes
 * d'ingrédients (on s'arrête quand on veut), 4. la compatibilité avec la famille.
 */
export function Questionnaire({
  style,
  suite,
  initial,
  others,
  nouvelles = false,
  enviesSeules = false,
  commencerParEnvies = false,
  initialEnvies,
}: {
  style: Style;
  suite: string;
  initial: Initial;
  others: Other[];
  /** A déjà répondu avant les nouvelles cartes : seulement celles-là. */
  nouvelles?: boolean;
  /** A déjà répondu avant l'écran « Tes envies » : seulement celui-là. */
  enviesSeules?: boolean;
  /** Nouvelles cartes ET écran des envies jamais vu : les envies d'abord. */
  commencerParEnvies?: boolean;
  initialEnvies: Envies;
}) {
  const router = useRouter();
  const [etape, setEtape] = useState<Etape>(
    enviesSeules || (nouvelles && commencerParEnvies) ? "envies" : nouvelles ? "cartes" : "regime",
  );
  const [envies, setEnvies] = useState<Envies>(initialEnvies);
  // Les envies ne sont enregistrées que si l'écran a été vu (pas en mode « nouvelles cartes »).
  const [enviesVues, setEnviesVues] = useState(false);
  const piquant = (c: Record<string, CardAnswer>, vues = enviesVues) => (vues ? avecPiquant(c, envies.piquant) : c);
  const [diets, setDiets] = useState<string[]>(initial.diets);
  const [autres, setAutres] = useState<string[]>(initial.autres);
  const [cards, setCards] = useState<Record<string, CardAnswer>>(initial.cards);
  const [index, setIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Une carte déjà couverte par un régime coché (poisson, fruits de mer) n'est pas reposée.
  // Le piquant est déjà répondu sur l'écran des envies.
  const deck = useMemo(
    () => cartesPour(diets).filter((f) => (!nouvelles || CARTES_AJOUTEES.includes(f.key)) && f.key !== "piment"),
    [diets, nouvelles],
  );

  const partir = () => {
    router.push(suite);
    router.refresh();
  };
  const enregistrer = (done: boolean, ensuite: () => void, vues = enviesVues) =>
    startTransition(async () => {
      setError(null);
      const res = await saveTastes({ diets, autres, cards: piquant(cards, vues), envies: vues ? envies : undefined, done });
      if (res.error) setError(res.error);
      else ensuite();
    });
  const plusTard = () =>
    nouvelles || enviesSeules
      ? enregistrer(true, partir)
      : etape === "regime"
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
      seed={etape === "regime" ? 17 : etape === "envies" ? 11 : etape === "cartes" ? 23 : 31}
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
          onNext={() => setEtape("envies")}
        />
      )}

      {etape === "envies" && (
        <EtapeEnvies
          envies={envies}
          setEnvies={setEnvies}
          pending={pending}
          seules={enviesSeules}
          onNext={() => {
            setEnviesVues(true);
            if (enviesSeules) return enregistrer(true, partir, true);
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
          nouvelles={nouvelles}
          onBack={index > 0 ? () => setIndex(index - 1) : () => setEtape(nouvelles ? "regime" : "envies")}
          onFini={() => enregistrer(true, () => setEtape("resultat"))}
        />
      )}

      {etape === "resultat" && (
        <EtapeResultat others={others} mine={niveaux(diets, autres, piquant(cards))} onDone={partir} />
      )}

      {error && <MessageErreur>{error}</MessageErreur>}
    </Scene>
  );
}

/** « Pas de piquant » = je n'aime pas le piment ; « j'adore » = je l'adore. */
function avecPiquant(cards: Record<string, CardAnswer>, piquant: Piquant): Record<string, CardAnswer> {
  const c = { ...cards };
  if (piquant === "non") c.piment = "pas_fan";
  else if (piquant === "oui") c.piment = "adore";
  else delete c.piment;
  return c;
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
        <p className="kd-etiquette text-blanc">Étape 1 sur 4</p>
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

// ─── 2. Tes envies ─────────────────────────────────────────────────────

const TEMPS: { key: Temps; label: string }[] = [
  { key: "30", label: "Moins de 30 min" },
  { key: "60", label: "Moins d'1 h" },
  { key: "any", label: "Peu importe" },
];
const PIQUANT: { key: Piquant; label: string }[] = [
  { key: "non", label: "Pas du tout" },
  { key: "un_peu", label: "Un peu" },
  { key: "oui", label: "J'adore" },
];

function EtapeEnvies({
  envies,
  setEnvies,
  pending,
  seules,
  onNext,
}: {
  envies: Envies;
  setEnvies: (fn: (e: Envies) => Envies) => void;
  pending: boolean;
  seules: boolean;
  onNext: () => void;
}) {
  const puce = (on: boolean) =>
    `inline-flex min-h-14 items-center rounded-bouton border-[3px] px-4 font-semibold active:scale-95 ${
      on ? "border-accent bg-accent text-on-accent" : "border-blanc text-blanc"
    }`;
  return (
    <div className="kd-monte flex flex-1 flex-col gap-5">
      <div>
        <p className="kd-etiquette text-blanc">{seules ? "Nouveau" : "Étape 2 sur 4"}</p>
        <h1 className="kd-titre-2 mt-2">Qu&apos;est-ce qui te fait envie&nbsp;?</h1>
        <p className="mt-1">Touche tout ce que tu aimes : Kaddie ira chercher ces plats-là.</p>
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Styles de plats">
        {STYLES.map((st) => {
          const on = envies.styles.includes(st.key);
          return (
            <button
              key={st.key}
              type="button"
              aria-pressed={on}
              onClick={() =>
                setEnvies((e) => ({ ...e, styles: on ? e.styles.filter((k) => k !== st.key) : [...e.styles, st.key] }))
              }
              className={puce(on)}
            >
              {st.label}
            </button>
          );
        })}
      </div>
      <div>
        <p className="kd-etiquette mb-2 text-blanc">En semaine, je cuisine</p>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Temps de cuisine">
          {TEMPS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="radio"
              aria-checked={envies.temps === t.key}
              onClick={() => setEnvies((e) => ({ ...e, temps: t.key }))}
              className={puce(envies.temps === t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="kd-etiquette mb-2 text-blanc">Le piquant</p>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Le piquant">
          {PIQUANT.map((t) => (
            <button
              key={t.key}
              type="button"
              role="radio"
              aria-checked={envies.piquant === t.key}
              onClick={() => setEnvies((e) => ({ ...e, piquant: t.key }))}
              className={puce(envies.piquant === t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-auto pb-4">
        <Bouton variante="secondaire" large disabled={pending} onClick={onNext}>
          {seules ? "C'est noté" : "Suivant"}
        </Bouton>
      </div>
    </div>
  );
}

// ─── 3. Les cartes d'ingrédients ───────────────────────────────────────

function EtapeCartes({
  style,
  deck,
  index,
  pending,
  onAnswer,
  onBack,
  onFini,
  nouvelles,
}: {
  nouvelles: boolean;
  onFini: () => void;
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
          {nouvelles ? "Nouvelles cartes" : "Étape 3 sur 4"} · carte {Math.min(index + 1, deck.length)} sur {deck.length}
        </p>
        <h1 className="kd-titre-2 mt-2">{nouvelles ? "De nouvelles cartes à swiper" : "Et ça, tu aimes\u00a0?"}</h1>
        {/* Où on en est : on voit que ça avance, et qu'on peut s'arrêter. */}
        <div
          role="progressbar"
          aria-label="Cartes répondues"
          aria-valuemin={0}
          aria-valuemax={deck.length}
          aria-valuenow={Math.min(index, deck.length)}
          className="mt-3 h-2.5 overflow-hidden rounded-full bg-aubergine"
        >
          <div className="h-full rounded-full bg-accent transition-[width] duration-240" style={{ width: `${(Math.min(index, deck.length) / Math.max(1, deck.length)) * 100}%` }} />
        </div>
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
        {pending ? (
          <Spinner className="w-7 text-blanc" />
        ) : (
          // S'arrêter quand on veut : les cartes restantes comptent comme « ça me va ».
          <button onClick={onFini} className="kd-btn kd-btn--secondaire min-h-12 px-5">
            J&apos;ai fini
          </button>
        )}
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

// ─── 4. La compatibilité ───────────────────────────────────────────────

function EtapeResultat({ others, mine, onDone }: { others: Other[]; mine: Record<string, TasteLevel>; onDone: () => void }) {
  return (
    <div className="kd-monte flex flex-1 flex-col gap-5">
      <div>
        <p className="kd-etiquette text-blanc">C&apos;est fini</p>
        <h1 className="kd-titre-1 mt-2">C&apos;est noté.</h1>
        <p className="mt-2">Le swipe de toute la famille en tient compte dès maintenant.</p>
      </div>
      {others.length > 0 && (
        <ul className="border-t-2 border-blanc/30">
          {others.map((o) => (
            <li key={o.name} className="flex min-h-16 items-center gap-3 border-b-2 border-blanc/30 py-2">
              <span className="min-w-0 flex-1 font-semibold">Toi et {o.name}</span>
              {o.done ? (
                <span className="font-display text-titre-3">{compatibility(mine, o.tastes)}&nbsp;% compatibles</span>
              ) : (
                <span className="kd-petit text-blanc">pas encore répondu</span>
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
