"use client";

/* eslint-disable @next/next/no-img-element -- aperçu local de la photo */
import { useActionState, useState, useTransition } from "react";
import { deleteRecipe, saveRecipe } from "@/app/actions/recipes";
import type { ImportedRecipe } from "@/lib/domain/recipe-import";
import { ImportFromUrl } from "./ImportFromUrl";
import { AISLES } from "@/lib/domain/aisles";
import type { RecipeWithIngredients } from "@/lib/data";
import { resizeImage } from "./resizeImage";
import { IconeCroix, IconePlus, MessageErreur } from "@/components/ui";
import { recipeConflicts, type MemberTastes } from "@/lib/domain/foods";

type Row = { key: number; name: string; quantity: string; unit: string; aisle: string };

const UNITS = ["g", "kg", "cl", "l", "gousses", "tranches", "paquet", "boîte", "botte", "pincée"];
let nextKey = 1;

function emptyRow(aisle = "fruits_legumes"): Row {
  return { key: nextKey++, name: "", quantity: "", unit: "", aisle };
}

export function RecipeForm({ recipe, gouts = [] }: { recipe?: RecipeWithIngredients; gouts?: MemberTastes[] }) {
  const [state, action, saving] = useActionState(saveRecipe, {});
  const [deleting, startDelete] = useTransition();
  const [rows, setRows] = useState<Row[]>(() =>
    recipe?.recipe_ingredients.length
      ? recipe.recipe_ingredients.map((i) => ({
          key: nextKey++,
          name: i.name,
          quantity: i.quantity == null ? "" : String(i.quantity).replace(".", ","),
          unit: i.unit,
          aisle: i.aisle,
        }))
      : [emptyRow()],
  );
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(recipe?.photo_url ?? null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [title, setTitle] = useState(recipe?.title ?? "");
  const [remotePhoto, setRemotePhoto] = useState<string | null>(null);
  const [servings, setServings] = useState<string | null>(null);

  function applyImport(imported: ImportedRecipe) {
    setTitle(imported.title);
    if (imported.ingredients.length > 0) {
      setRows(
        imported.ingredients.map((i) => ({
          key: nextKey++,
          name: i.name,
          quantity: i.quantity == null ? "" : String(i.quantity).replace(".", ","),
          unit: i.unit,
          aisle: i.aisle,
        })),
      );
    }
    if (imported.imageUrl) {
      setPhoto(null);
      setRemotePhoto(imported.imageUrl);
      setPreview(imported.imageUrl);
      setRemovePhoto(false);
    }
    setServings(imported.servings);
  }

  // Un aliment interdit pour quelqu'un ? On prévient tout de suite (la recette sera cachée du swipe).
  const interditPour = recipeConflicts([title, ...rows.map((r) => r.name)], gouts, false).interditPar;

  const update = (key: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  async function onPhoto(file: File | undefined) {
    if (!file) return;
    setPhotoBusy(true);
    try {
      const small = await resizeImage(file);
      setPhoto(small);
      setRemotePhoto(null);
      setPreview(URL.createObjectURL(small));
      setRemovePhoto(false);
    } catch {
      alert("Impossible de lire cette photo.");
    } finally {
      setPhotoBusy(false);
    }
  }

  return (
    <form
      action={(fd) => {
        fd.delete("photo_input");
        if (photo) fd.set("photo", photo);
        action(fd);
      }}
      className="flex flex-col gap-6"
    >
      <ImportFromUrl onImport={applyImport} compact={Boolean(recipe)} />

      {recipe && <input type="hidden" name="id" value={recipe.id} />}
      {remotePhoto && <input type="hidden" name="photo_remote_url" value={remotePhoto} />}
      <input type="hidden" name="remove_photo" value={removePhoto ? "1" : "0"} />
      <input
        type="hidden"
        name="ingredients"
        value={JSON.stringify(rows.map(({ name, quantity, unit, aisle }) => ({ name, quantity, unit, aisle })))}
      />

      {/* L'emoji reste enregistré (champ en base), sans être affiché. */}
      <input type="hidden" name="emoji" value={recipe?.emoji ?? "🍽️"} />
      <label className="block">
        <span className="kd-etiquette mb-2 block">Nom du plat</span>
        <input
          name="title"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          placeholder="Poulet basquaise"
          className="kd-champ"
        />
      </label>

      <div>
        <span className="kd-etiquette mb-2 block">Photo</span>
        <div className="flex items-center gap-4">
          {preview ? (
            <img src={preview} alt="" referrerPolicy="no-referrer" className="size-28 rounded-carte object-cover" />
          ) : (
            <div aria-hidden className="size-28 rounded-carte bg-trait" />
          )}
          <div className="flex flex-col gap-2">
            <label className="kd-btn kd-btn--secondaire cursor-pointer has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-focus">
              {photoBusy ? "…" : preview ? "Changer" : "Ajouter une photo"}
              <input
                type="file"
                name="photo_input"
                accept="image/*"
                className="sr-only"
                onChange={(e) => onPhoto(e.target.files?.[0])}
              />
            </label>
            {preview && (
              <button
                type="button"
                onClick={() => {
                  setPhoto(null);
                  setRemotePhoto(null);
                  setPreview(null);
                  setRemovePhoto(true);
                }}
                className="min-h-14 text-encre-douce underline underline-offset-4"
              >
                Retirer la photo
              </button>
            )}
          </div>
        </div>
      </div>

      <fieldset className="min-w-0">
        <legend className="kd-etiquette mb-2">Ingrédients</legend>
        {servings && (
          <p className="mb-3 text-encre-douce">
            Quantités prévues pour <strong className="text-encre">{servings}</strong>&nbsp;: ajuste-les si besoin.
          </p>
        )}
        <datalist id="units">
          {UNITS.map((u) => (
            <option key={u} value={u} />
          ))}
        </datalist>
        <ul className="flex flex-col gap-3">
          {rows.map((row) => (
            <li key={row.key} className="flex flex-col gap-2 rounded-carte bg-surface p-3">
              <div className="flex gap-2">
                <input
                  aria-label="Ingrédient"
                  value={row.name}
                  onChange={(e) => update(row.key, { name: e.target.value })}
                  placeholder="Ingrédient"
                  className="kd-champ min-w-0 flex-1"
                />
                <button
                  type="button"
                  aria-label="Supprimer l'ingrédient"
                  onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((r) => r.key !== row.key) : [emptyRow()]))}
                  className="flex size-14 shrink-0 items-center justify-center text-encre-douce"
                >
                  <IconeCroix className="size-6" />
                </button>
              </div>
              <div className="flex gap-2">
                <input
                  aria-label="Quantité"
                  value={row.quantity}
                  onChange={(e) => update(row.key, { quantity: e.target.value })}
                  inputMode="decimal"
                  placeholder="Qté"
                  className="kd-champ w-20 px-3"
                />
                <input
                  aria-label="Unité"
                  value={row.unit}
                  onChange={(e) => update(row.key, { unit: e.target.value })}
                  list="units"
                  placeholder="unité"
                  className="kd-champ w-24 px-3"
                />
                <select
                  aria-label="Rayon"
                  value={row.aisle}
                  onChange={(e) => update(row.key, { aisle: e.target.value })}
                  className="kd-champ min-w-0 flex-1 px-2"
                >
                  {AISLES.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label}
                    </option>
                  ))}
                </select>
              </div>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => setRows((rs) => [...rs, emptyRow(rs[rs.length - 1]?.aisle)])}
          className="mt-3 flex min-h-14 w-full items-center justify-center gap-2 rounded-bouton border-[3px] border-dashed border-encre-douce font-semibold text-encre-douce"
        >
          <IconePlus className="size-6" /> Ajouter un ingrédient
        </button>
      </fieldset>

      {interditPour.length > 0 && (
        <p role="status" className="rounded-pastille bg-aubergine px-4 py-3 text-blanc">
          Interdit pour {interditPour.join(", ")}&nbsp;: cette recette sera cachée du swipe, des matchs et des courses.
        </p>
      )}

      {state.error && <MessageErreur>{state.error}</MessageErreur>}

      <button
        type="submit"
        disabled={saving || photoBusy || deleting}
        className="kd-btn kd-btn--large"
      >
        {saving ? "Enregistrement…" : "Enregistrer"}
      </button>

      {recipe && (
        <button
          type="button"
          disabled={saving || deleting}
          onClick={() => confirm(`Supprimer « ${recipe.title} » ?`) && startDelete(() => deleteRecipe(recipe.id))}
          className="min-h-14 w-full text-encre-douce underline underline-offset-4 disabled:opacity-50"
        >
          {deleting ? "Suppression…" : "Supprimer cette recette"}
        </button>
      )}
    </form>
  );
}
