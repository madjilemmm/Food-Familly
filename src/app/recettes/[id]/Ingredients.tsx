"use client";

import { useState } from "react";
import { formatQuantity, scaleIngredients } from "@/lib/domain/shopping-list";
import { IconePlus } from "@/components/ui";

type Ingredient = { id: string; name: string; quantity: number | null; unit: string };

/** Les ingrédients, ajustés au nombre de personnes (celui des courses en cours, ou toute la famille). */
export function Ingredients({ ingredients, servings, people }: { ingredients: Ingredient[]; servings: number | null; people: number }) {
  const [n, setN] = useState(people);
  const liste = scaleIngredients(ingredients, servings, n);
  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center gap-3">
        <h2 className="kd-titre-2 flex-1 text-aubergine">Pour {n}</h2>
        {servings && (
          <>
            <button type="button" aria-label="Une personne de moins" disabled={n <= 1} onClick={() => setN(n - 1)} className="kd-btn kd-btn--secondaire w-14 px-0 text-titre-2">
              −
            </button>
            <button type="button" aria-label="Une personne de plus" disabled={n >= 30} onClick={() => setN(n + 1)} className="kd-btn kd-btn--secondaire w-14 px-0">
              <IconePlus />
            </button>
          </>
        )}
      </div>
      {!servings && <p className="kd-petit mb-2">Quantités de la recette d&apos;origine (nombre de personnes inconnu).</p>}
      <ul className="kd-liste">
        {liste.map((i) => (
          <li key={i.id} className="kd-liste__article justify-between">
            <span>{i.name}</span>
            {(i.quantity != null || i.unit) && <span className="text-encre-douce">{formatQuantity(i.quantity, i.unit)}</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}
