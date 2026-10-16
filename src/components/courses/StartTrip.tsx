"use client";

import { useState } from "react";
import { Spinner } from "@/components/Spinner";
import { IconeRetour } from "@/components/ui";
import type { DepartureChoice } from "@/lib/domain/trip";

/**
 * « Je pars dans… » : une ligne par durée, comme une liste de recettes. À gauche,
 * l'heure de départ (ce que la famille verra) ; un appui et c'est parti.
 * Un formulaire HTML classique (POST puis redirection) : l'écran suit à coup sûr.
 */
export function StartTrip({
  choices,
  others,
}: {
  choices: { id: DepartureChoice; label: string; heure: string }[];
  /** Les autres membres, prévenus par notification. */
  others: string[];
}) {
  const [choisi, setChoisi] = useState<DepartureChoice | null>(null);
  const names = others.length > 1 ? `${others.slice(0, -1).join(", ")} et ${others[others.length - 1]}` : others[0];
  const who =
    others.length === 0
      ? "Ajoute ta famille dans les réglages pour la prévenir."
      : others.length > 4
        ? "Toute la famille reçoit une notif et choisit ses plats."
        : `${names} ${others.length > 1 ? "reçoivent" : "reçoit"} une notif et ${others.length > 1 ? "choisissent leurs" : "choisit ses"} plats.`;

  return (
    <section>
      <h2 className="kd-etiquette mb-2">Je pars faire les courses dans…</h2>
      <form method="post" action="/api/courses/depart">
        <ul className="kd-liste border-t-2 border-trait">
          {choices.map((c) => {
            const soir = c.id === "soir";
            const actif = choisi === c.id;
            return (
              <li key={c.id}>
                <button
                  type="submit"
                  name="choice"
                  value={c.id}
                  onClick={(e) => (choisi ? e.preventDefault() : setChoisi(c.id))}
                  aria-busy={actif}
                  className={`flex w-full items-center gap-4 border-b-2 border-trait py-2 text-left transition-opacity active:bg-trait/40 ${
                    choisi && !actif ? "opacity-40" : ""
                  }`}
                >
                  <span className="grid size-14 shrink-0 place-content-center rounded-pastille bg-aubergine font-display text-[1.05rem] leading-none text-blanc">
                    {actif ? <Spinner className="w-7" /> : c.heure.replace(" h ", ":")}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col items-start gap-1">
                    <span className="font-semibold">{soir ? "Ce soir" : `Dans ${c.label}`}</span>
                    <span className="kd-petit">Réponses jusqu&apos;à {c.heure}</span>
                  </span>
                  <IconeRetour className="size-6 shrink-0 rotate-180 text-violet" />
                </button>
              </li>
            );
          })}
        </ul>
      </form>
      <p className="kd-petit mt-3">{who}</p>
    </section>
  );
}
