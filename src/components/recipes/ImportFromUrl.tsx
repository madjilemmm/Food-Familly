"use client";

import { useState, useTransition } from "react";
import { importRecipeFromUrl } from "@/app/actions/recipes";
import type { ImportedRecipe } from "@/lib/domain/recipe-import";
import { MessageErreur } from "@/components/ui";

/**
 * Pré-remplit le formulaire à partir d'un lien Marmiton, 750g, Cuisine AZ…
 * Rien n'est enregistré tant qu'on n'a pas touché « Enregistrer ».
 */
export function ImportFromUrl({ onImport, compact }: { onImport: (r: ImportedRecipe) => void; compact: boolean }) {
  const [open, setOpen] = useState(!compact);
  const [url, setUrl] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function run(link: string) {
    const clean = link.trim().match(/https?:\/\/\S+/)?.[0];
    if (!clean) {
      setMessage({ ok: false, text: "Colle le lien complet de la recette (il commence par https://)." });
      return;
    }
    setUrl(clean);
    setMessage(null);
    startTransition(async () => {
      const res = await importRecipeFromUrl(clean);
      if (res.recipe) {
        onImport(res.recipe);
        const n = res.recipe.ingredients.length;
        setMessage({
          ok: true,
          text: `« ${res.recipe.title} » importée${n ? ` avec ${n} ingrédients` : ""}. Vérifie puis enregistre.`,
        });
      } else {
        setMessage({ ok: false, text: res.error ?? "Import impossible." });
      }
    });
  }

  async function pasteAndImport() {
    try {
      const text = await navigator.clipboard.readText();
      run(text);
    } catch {
      setMessage({ ok: false, text: "Colle le lien dans le champ ci-dessous." });
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="kd-btn kd-btn--secondaire kd-btn--large">
        Remplir depuis un site de recettes
      </button>
    );
  }

  return (
    <section className="kd-carte gap-3 p-4">
      <h2 className="kd-titre-3 text-aubergine">Importer depuis un site</h2>
      <p className="kd-petit">Marmiton, 750g, Cuisine AZ, Ptitchef… Copie le lien de la recette, puis touche le bouton.</p>
      <button type="button" onClick={pasteAndImport} disabled={pending} className="kd-btn kd-btn--secondaire kd-btn--large">
        {pending ? "Import en cours…" : "Coller le lien et importer"}
      </button>
      <div className="flex gap-2">
        <input
          type="url"
          inputMode="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              run(url);
            }
          }}
          placeholder="ou colle le lien ici"
          className="kd-champ min-w-0 flex-1"
        />
        <button type="button" onClick={() => run(url)} disabled={pending || !url.trim()} className="kd-btn kd-btn--secondaire shrink-0 px-4">
          OK
        </button>
      </div>
      {message &&
        (message.ok ? (
          <p role="status" className="rounded-pastille bg-accent px-4 py-3 text-on-accent">
            {message.text}
          </p>
        ) : (
          <MessageErreur>{message.text}</MessageErreur>
        ))}
    </section>
  );
}
