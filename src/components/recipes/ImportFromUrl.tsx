"use client";

import { useState, useTransition } from "react";
import { importRecipeFromUrl } from "@/app/actions/recipes";
import type { ImportedRecipe } from "@/lib/domain/recipe-import";

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
      setMessage({ ok: false, text: "Collez le lien complet de la recette (il commence par https://)." });
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
          text: `« ${res.recipe.title} » importée${n ? ` avec ${n} ingrédients` : ""}. Vérifiez puis enregistrez.`,
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
      setMessage({ ok: false, text: "Collez le lien dans le champ ci-dessous." });
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="w-full rounded-2xl bg-white py-3 font-semibold text-stone-600 shadow-sm">
        🔗 Remplir depuis un site de recettes
      </button>
    );
  }

  return (
    <section className="rounded-3xl bg-gradient-to-br from-amber-100 to-orange-100 p-4">
      <h2 className="text-lg font-bold">🔗 Importer depuis un site</h2>
      <p className="mb-3 text-sm text-stone-600">
        Marmiton, 750g, Cuisine AZ, Ptitchef… Copiez le lien de la recette, puis touchez le bouton.
      </p>
      <button
        type="button"
        onClick={pasteAndImport}
        disabled={pending}
        className="mb-2 w-full rounded-2xl bg-tomato-500 py-3 text-lg font-bold text-white shadow active:scale-[0.98] disabled:opacity-60"
      >
        {pending ? "Import en cours…" : "📋 Coller le lien et importer"}
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
          placeholder="ou collez le lien ici"
          className="min-w-0 flex-1 rounded-xl border-2 border-white bg-white px-3 py-2 outline-none focus:border-tomato-500"
        />
        <button
          type="button"
          onClick={() => run(url)}
          disabled={pending || !url.trim()}
          className="shrink-0 rounded-xl bg-stone-800 px-4 font-semibold text-white disabled:opacity-40"
        >
          OK
        </button>
      </div>
      {message && (
        <p className={`mt-3 rounded-xl px-3 py-2 ${message.ok ? "bg-emerald-100 text-emerald-900" : "bg-red-100 text-red-800"}`}>
          {message.text}
        </p>
      )}
    </section>
  );
}
