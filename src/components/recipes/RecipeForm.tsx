"use client";

/* eslint-disable @next/next/no-img-element -- aperçu local de la photo */
import { useActionState, useState, useTransition } from "react";
import { deleteRecipe, saveRecipe } from "@/app/actions/recipes";
import { AISLES } from "@/lib/domain/aisles";
import type { RecipeWithIngredients } from "@/lib/data";
import { resizeImage } from "./resizeImage";

type Row = { key: number; name: string; quantity: string; unit: string; aisle: string };

const UNITS = ["g", "kg", "cl", "l", "gousses", "tranches", "paquet", "boîte", "botte", "pincée"];
let nextKey = 1;

function emptyRow(aisle = "fruits_legumes"): Row {
  return { key: nextKey++, name: "", quantity: "", unit: "", aisle };
}

export function RecipeForm({ recipe }: { recipe?: RecipeWithIngredients }) {
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

  const update = (key: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  async function onPhoto(file: File | undefined) {
    if (!file) return;
    setPhotoBusy(true);
    try {
      const small = await resizeImage(file);
      setPhoto(small);
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
      className="space-y-6"
    >
      {recipe && <input type="hidden" name="id" value={recipe.id} />}
      <input type="hidden" name="remove_photo" value={removePhoto ? "1" : "0"} />
      <input
        type="hidden"
        name="ingredients"
        value={JSON.stringify(rows.map(({ name, quantity, unit, aisle }) => ({ name, quantity, unit, aisle })))}
      />

      <div className="flex gap-3">
        <label className="w-20 shrink-0">
          <span className="mb-1 block font-semibold">Emoji</span>
          <input
            name="emoji"
            defaultValue={recipe?.emoji ?? "🍽️"}
            maxLength={8}
            className="w-full rounded-2xl border-2 border-stone-200 bg-white px-2 py-3 text-center text-2xl outline-none focus:border-tomato-500"
          />
        </label>
        <label className="flex-1">
          <span className="mb-1 block font-semibold">Nom du plat</span>
          <input
            name="title"
            required
            defaultValue={recipe?.title}
            maxLength={120}
            placeholder="Ex : Poulet basquaise"
            className="w-full rounded-2xl border-2 border-stone-200 bg-white px-4 py-3 text-xl outline-none focus:border-tomato-500"
          />
        </label>
      </div>

      <div>
        <span className="mb-1 block font-semibold">Photo</span>
        <div className="flex items-center gap-4">
          {preview ? (
            <img src={preview} alt="" className="size-28 rounded-2xl object-cover" />
          ) : (
            <div className="flex size-28 items-center justify-center rounded-2xl bg-stone-100 text-4xl">📷</div>
          )}
          <div className="flex flex-col gap-2">
            <label className="cursor-pointer rounded-full bg-stone-800 px-5 py-3 text-center font-semibold text-white">
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
                  setPreview(null);
                  setRemovePhoto(true);
                }}
                className="text-stone-500 underline"
              >
                Retirer la photo
              </button>
            )}
          </div>
        </div>
      </div>

      <fieldset className="min-w-0">
        <legend className="mb-2 font-semibold">Ingrédients</legend>
        <datalist id="units">
          {UNITS.map((u) => (
            <option key={u} value={u} />
          ))}
        </datalist>
        <ul className="space-y-3">
          {rows.map((row) => (
            <li key={row.key} className="rounded-2xl bg-white p-3 shadow-sm">
              <div className="flex gap-2">
                <input
                  aria-label="Ingrédient"
                  value={row.name}
                  onChange={(e) => update(row.key, { name: e.target.value })}
                  placeholder="Ingrédient"
                  className="min-w-0 flex-1 rounded-xl border-2 border-stone-200 px-3 py-2 outline-none focus:border-tomato-500"
                />
                <button
                  type="button"
                  aria-label="Supprimer l'ingrédient"
                  onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((r) => r.key !== row.key) : [emptyRow()]))}
                  className="px-2 text-xl text-stone-400"
                >
                  ✕
                </button>
              </div>
              <div className="mt-2 flex gap-2">
                <input
                  aria-label="Quantité"
                  value={row.quantity}
                  onChange={(e) => update(row.key, { quantity: e.target.value })}
                  inputMode="decimal"
                  placeholder="Qté"
                  className="w-20 rounded-xl border-2 border-stone-200 px-3 py-2 outline-none focus:border-tomato-500"
                />
                <input
                  aria-label="Unité"
                  value={row.unit}
                  onChange={(e) => update(row.key, { unit: e.target.value })}
                  list="units"
                  placeholder="unité"
                  className="w-24 rounded-xl border-2 border-stone-200 px-3 py-2 outline-none focus:border-tomato-500"
                />
                <select
                  aria-label="Rayon"
                  value={row.aisle}
                  onChange={(e) => update(row.key, { aisle: e.target.value })}
                  className="min-w-0 flex-1 rounded-xl border-2 border-stone-200 bg-white px-2 py-2 outline-none focus:border-tomato-500"
                >
                  {AISLES.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.emoji} {a.label}
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
          className="mt-3 w-full rounded-2xl border-2 border-dashed border-stone-300 py-3 font-semibold text-stone-600"
        >
          + Ajouter un ingrédient
        </button>
      </fieldset>

      {state.error && <p className="rounded-xl bg-tomato-50 px-4 py-3 text-tomato-700">{state.error}</p>}

      <button
        type="submit"
        disabled={saving || photoBusy || deleting}
        className="w-full rounded-2xl bg-tomato-500 py-4 text-xl font-bold text-white shadow-lg disabled:opacity-60"
      >
        {saving ? "Enregistrement…" : "Enregistrer"}
      </button>

      {recipe && (
        <button
          type="button"
          disabled={saving || deleting}
          onClick={() => confirm(`Supprimer « ${recipe.title} » ?`) && startDelete(() => deleteRecipe(recipe.id))}
          className="w-full py-3 text-tomato-600 underline disabled:opacity-50"
        >
          {deleting ? "Suppression…" : "Supprimer cette recette"}
        </button>
      )}
    </form>
  );
}
