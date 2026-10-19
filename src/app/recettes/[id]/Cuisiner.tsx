"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { Scene } from "@/design-system/components/Kaddie";
import { marquerRepas } from "@/app/actions/trips";
import { formatQuantity, scaleIngredients } from "@/lib/domain/shopping-list";
import { IconeCroix, IconeRetour } from "@/components/ui";
import { dureeDans } from "@/lib/domain/cuisine";
import { Ingredients } from "./Ingredients";

type Ingredient = { id: string; name: string; quantity: number | null; unit: string };

/**
 * Les ingrédients (pour combien), et « Je cuisine » : une étape par écran, en grand,
 * l'écran reste allumé, les durées deviennent des minuteurs. À la fin, « C'est fait ».
 */
export function Cuisiner({
  recipeId,
  ingredients,
  servings,
  people,
  steps,
  repasTripId,
}: {
  recipeId: string;
  ingredients: Ingredient[];
  servings: number | null;
  people: number;
  steps: string[];
  /** Le plat a été acheté à la dernière course : « C'est fait » le range dans « Ce soir ». */
  repasTripId: string | null;
}) {
  const nombre = useState(people);
  const [ouvert, setOuvert] = useState(false);
  return (
    <>
      {steps.length > 0 && (
        <button type="button" onClick={() => setOuvert(true)} className="kd-btn kd-btn--large mt-6">
          Je cuisine
        </button>
      )}
      <Ingredients ingredients={ingredients} servings={servings} people={people} nombre={nombre} />
      {ouvert && (
        <ModeCuisine
          recipeId={recipeId}
          ingredients={scaleIngredients(ingredients, servings, nombre[0])}
          pour={nombre[0]}
          steps={steps}
          repasTripId={repasTripId}
          onFermer={() => setOuvert(false)}
        />
      )}
    </>
  );
}

function ModeCuisine({
  recipeId,
  ingredients,
  pour,
  steps,
  repasTripId,
  onFermer,
}: {
  recipeId: string;
  ingredients: Ingredient[];
  pour: number;
  steps: string[];
  repasTripId: string | null;
  onFermer: () => void;
}) {
  // Écran 0 : ce qu'il faut ; puis une étape par écran ; puis « Bon appétit ».
  const total = steps.length + 2;
  const [i, setI] = useState(0);
  const [pending, startTransition] = useTransition();
  const depart = useRef<number | null>(null);
  const aller = (k: number) => setI(Math.max(0, Math.min(total - 1, k)));

  // L'écran reste allumé pendant qu'on cuisine (si le téléphone le permet).
  useEffect(() => {
    let verrou: { release: () => Promise<void> } | null = null;
    const demander = async () => {
      try {
        verrou = (await (navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } }).wakeLock?.request("screen")) ?? null;
      } catch {
        verrou = null;
      }
    };
    const auRetour = () => document.visibilityState === "visible" && demander();
    demander();
    document.addEventListener("visibilitychange", auRetour);
    const avant = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("visibilitychange", auRetour);
      document.body.style.overflow = avant;
      verrou?.release().catch(() => {});
    };
  }, []);

  const etape = i >= 1 && i <= steps.length ? steps[i - 1] : null;
  const duree = etape ? dureeDans(etape) : null;

  return createPortal(
    <Scene
      as="div"
      duo="aubergine"
      seed={23}
      role="dialog"
      aria-modal="true"
      aria-label="Je cuisine"
      className="pb-safe fixed inset-0 z-50 flex flex-col px-5 pt-[max(env(safe-area-inset-top),1rem)]"
      onPointerDown={(e: React.PointerEvent) => (depart.current = e.clientX)}
      onPointerUp={(e: React.PointerEvent) => {
        const dx = depart.current == null ? 0 : e.clientX - depart.current;
        depart.current = null;
        if (Math.abs(dx) > 60) aller(i + (dx < 0 ? 1 : -1));
      }}
    >
      <header className="flex items-center justify-between pt-2">
        <p className="kd-etiquette text-blanc">{etape ? `Étape ${i} sur ${steps.length}` : i === 0 ? `Pour ${pour}` : "C'est prêt"}</p>
        <button type="button" onClick={onFermer} aria-label="Quitter le mode cuisine" className="flex size-14 items-center justify-center rounded-full bg-blanc text-aubergine">
          <IconeCroix />
        </button>
      </header>
      {/* Où on en est : une pastille par écran. */}
      <div aria-hidden className="mt-3 flex gap-1.5">
        {Array.from({ length: total }, (_, k) => (
          <span key={k} className={`h-1.5 flex-1 rounded-full ${k <= i ? "bg-accent" : "bg-blanc/30"}`} />
        ))}
      </div>

      <div aria-live="polite" className="kd-monte flex flex-1 flex-col justify-center gap-6 overflow-y-auto py-6" key={i}>
        {i === 0 && (
          <>
            <h2 className="kd-titre-1">Ce qu&apos;il te faut</h2>
            <ul className="flex flex-col gap-2 text-titre-3">
              {ingredients.map((ing) => (
                <li key={ing.id} className="flex justify-between gap-4 border-b-2 border-blanc/20 pb-2">
                  <span>{ing.name}</span>
                  {(ing.quantity != null || ing.unit) && <span className="shrink-0 font-semibold">{formatQuantity(ing.quantity, ing.unit)}</span>}
                </li>
              ))}
            </ul>
          </>
        )}
        {etape && (
          <>
            <p className="font-display text-titre-2 leading-snug">{etape}</p>
            {duree && <Minuteur key={i} minutes={duree} />}
          </>
        )}
        {i === total - 1 && (
          <div className="flex flex-col items-start gap-5">
            <h2 className="kd-titre-1">Bon appétit&nbsp;!</h2>
            {repasTripId ? (
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    await marquerRepas(repasTripId, recipeId, true).catch(() => {});
                    onFermer();
                  })
                }
                className="kd-btn kd-btn--secondaire kd-btn--large w-full"
              >
                C&apos;est fait
              </button>
            ) : (
              <button type="button" onClick={onFermer} className="kd-btn kd-btn--secondaire kd-btn--large w-full">
                Fermer
              </button>
            )}
          </div>
        )}
      </div>

      <nav className="flex gap-3 pb-4">
        <button type="button" disabled={i === 0} onClick={() => aller(i - 1)} aria-label="Étape d'avant" className="kd-btn kd-btn--secondaire w-20 shrink-0 px-0 disabled:opacity-30">
          <IconeRetour />
        </button>
        {i < total - 1 && (
          <button type="button" onClick={() => aller(i + 1)} className="kd-btn kd-btn--secondaire kd-btn--large flex-1">
            {i === 0 ? "C'est parti" : i === total - 2 ? "J'ai fini" : "Étape suivante"}
          </button>
        )}
      </nav>
    </Scene>,
    document.body,
  );
}

/** Un minuteur d'un appui ; il vibre à la fin (si le téléphone le permet). */
function Minuteur({ minutes }: { minutes: number }) {
  const [fin, setFin] = useState<number | null>(null);
  const [, tic] = useState(0);
  useEffect(() => {
    if (!fin) return;
    const t = setInterval(() => {
      tic((x) => x + 1);
      if (Date.now() >= fin) {
        navigator.vibrate?.([300, 150, 300]);
        clearInterval(t);
      }
    }, 1000);
    return () => clearInterval(t);
  }, [fin]);
  if (!fin) {
    return (
      <button type="button" onClick={() => setFin(Date.now() + minutes * 60_000)} className="kd-btn kd-btn--like self-start px-6">
        Minuteur {minutes} min
      </button>
    );
  }
  const reste = Math.max(0, Math.round((fin - Date.now()) / 1000));
  return (
    <p role="timer" className="font-display text-titre-1">
      {reste === 0 ? "C'est l'heure !" : `${Math.floor(reste / 60)}:${String(reste % 60).padStart(2, "0")}`}
    </p>
  );
}
