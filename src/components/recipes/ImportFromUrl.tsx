"use client";

import { useState, useTransition } from "react";
import { importRecipeFromUrl } from "@/app/actions/recipes";
import type { ImportedRecipe } from "@/lib/domain/recipe-import";
import { MessageErreur } from "@/components/ui";
import { messageErreur } from "@/lib/reseau";

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
      let res: Awaited<ReturnType<typeof importRecipeFromUrl>>;
      try {
        res = await importRecipeFromUrl(clean);
      } catch (e) {
        setMessage({ ok: false, text: messageErreur(e) });
        return;
      }
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
      <button type="button" onClick={() => setOpen(true)} className="min-h-12 self-start text-violet underline underline-offset-4">
        Remplir depuis un site de recettes
      </button>
    );
  }

  // Une ligne : le champ et son bouton. Le collage direct reste à portée, en lien.
  return (
    <section className="flex flex-col gap-2">
      <p className="kd-etiquette">Remplir depuis un site (Marmiton, 750g…)</p>
      <div className="flex gap-2">
        <input
          type="url"
          inputMode="url"
          aria-label="Lien de la recette"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              run(url);
            }
          }}
          placeholder="Lien de la recette"
          className="kd-champ min-w-0 flex-1"
        />
        <button type="button" onClick={() => run(url)} disabled={pending || !url.trim()} className="kd-btn kd-btn--secondaire shrink-0 px-4">
          {pending ? "…" : "Importer"}
        </button>
      </div>
      <button type="button" onClick={pasteAndImport} disabled={pending} className="min-h-12 self-start text-violet underline underline-offset-4">
        {pending ? "Import en cours…" : "Coller le lien et importer"}
      </button>
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
