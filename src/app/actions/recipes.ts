"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/supabase/server";
import { isAisle } from "@/lib/domain/aisles";
import { extractRecipe, type ImportedRecipe } from "@/lib/domain/recipe-import";
import { safeFetch } from "@/lib/safe-fetch";
import { changed, cleanText } from "./_shared";

const BUCKET = "recipe-photos";
const MAX_PHOTO_BYTES = 4 * 1024 * 1024;

type IngredientInput = { name: string; quantity: number | null; unit: string; aisle: string };

function parseIngredients(raw: FormDataEntryValue | null): IngredientInput[] {
  let list: unknown;
  try {
    list = JSON.parse(typeof raw === "string" ? raw : "[]");
  } catch {
    return [];
  }
  if (!Array.isArray(list)) return [];
  return list.slice(0, 60).flatMap((item) => {
    const name = typeof item?.name === "string" ? item.name.trim().slice(0, 100) : "";
    if (!name) return [];
    const q = Number(String(item.quantity ?? "").replace(",", "."));
    return [
      {
        name,
        quantity: Number.isFinite(q) && q > 0 ? Math.round(q * 1000) / 1000 : null,
        unit: typeof item.unit === "string" ? item.unit.trim().slice(0, 20) : "",
        aisle: isAisle(item.aisle) ? item.aisle : "autre",
      },
    ];
  });
}

function storagePath(publicUrl: string | null): string | null {
  if (!publicUrl) return null;
  const marker = `/object/public/${BUCKET}/`;
  const i = publicUrl.indexOf(marker);
  return i === -1 ? null : decodeURIComponent(publicUrl.slice(i + marker.length));
}

const IMAGE_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

/** Récupère la photo d'un site et la range dans notre stockage (les liens externes finissent par casser). */
async function downloadPhoto(url: string): Promise<File> {
  const { body, contentType } = await safeFetch(url, { maxBytes: MAX_PHOTO_BYTES, accept: "image/*" });
  const type = contentType.split(";")[0].trim().toLowerCase();
  if (!IMAGE_TYPES[type]) throw new Error("La photo de ce site n'est pas dans un format accepté.");
  return new File([new Uint8Array(body)], `photo.${IMAGE_TYPES[type]}`, { type });
}

/** Lit une recette sur un site de cuisine pour pré-remplir le formulaire. */
export async function importRecipeFromUrl(url: string): Promise<{ recipe?: ImportedRecipe; error?: string }> {
  await requireUser();
  try {
    const { body, contentType } = await safeFetch(url, { maxBytes: 3 * 1024 * 1024, accept: "text/html" });
    if (!contentType.includes("html")) return { error: "Ce lien ne mène pas à une page de recette." };
    const recipe = extractRecipe(body.toString("utf8"));
    if (!recipe || !recipe.title) return { error: "Je n'ai pas trouvé de recette sur cette page." };
    return { recipe };
  } catch (err) {
    console.warn("Import de recette impossible :", url, err);
    const message = err instanceof Error && !/fetch failed|aborted|timeout/i.test(err.message) ? err.message : "Le site ne répond pas.";
    return { error: `Import impossible : ${message}` };
  }
}

async function uploadPhoto(recipeId: string, file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Le fichier n'est pas une image");
  if (file.size > MAX_PHOTO_BYTES) throw new Error("Photo trop lourde");
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${recipeId}/${Date.now()}.${ext}`;
  const { error } = await db().storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: true });
  if (error) throw new Error(`Envoi de la photo impossible : ${error.message}`);
  return db().storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

export async function saveRecipe(_prev: { error?: string }, formData: FormData): Promise<{ error?: string }> {
  await requireUser();
  const id = cleanText(formData.get("id"), 64) || null;
  const title = cleanText(formData.get("title"), 120);
  const emoji = cleanText(formData.get("emoji"), 16) || "🍽️";
  const ingredients = parseIngredients(formData.get("ingredients"));
  const photo = formData.get("photo");
  const removePhoto = formData.get("remove_photo") === "1";
  const remotePhoto = cleanText(formData.get("photo_remote_url"), 2000);

  if (!title) return { error: "Donnez un nom à la recette." };

  let recipeId = id;
  let oldPhoto: string | null = null;

  try {
    if (recipeId) {
      const { data: existing } = await db().from("recipes").select("photo_url").eq("id", recipeId).maybeSingle();
      if (!existing) return { error: "Cette recette n'existe plus." };
      oldPhoto = existing.photo_url;
      const { error } = await db().from("recipes").update({ title, emoji }).eq("id", recipeId);
      if (error) throw error;
    } else {
      const { data, error } = await db().from("recipes").insert({ title, emoji }).select("id").single();
      if (error) throw error;
      recipeId = data.id as string;
    }

    // Photo : nouvelle, supprimée ou inchangée
    let photoUrl: string | null | undefined;
    if (photo instanceof File && photo.size > 0) photoUrl = await uploadPhoto(recipeId!, photo);
    else if (remotePhoto) {
      // Une photo introuvable ne doit pas empêcher d'enregistrer la recette.
      photoUrl = await downloadPhoto(remotePhoto)
        .then((file) => uploadPhoto(recipeId!, file))
        .catch((err) => {
          console.warn("Photo du site non récupérée :", remotePhoto, err);
          return undefined;
        });
    }
    else if (removePhoto) photoUrl = null;
    if (photoUrl !== undefined) {
      await db().from("recipes").update({ photo_url: photoUrl }).eq("id", recipeId);
      const oldPath = storagePath(oldPhoto);
      if (oldPath) await db().storage.from(BUCKET).remove([oldPath]);
    }

    // Ingrédients : remplacés en bloc
    await db().from("recipe_ingredients").delete().eq("recipe_id", recipeId);
    if (ingredients.length > 0) {
      const { error } = await db()
        .from("recipe_ingredients")
        .insert(ingredients.map((ing, position) => ({ ...ing, position, recipe_id: recipeId })));
      if (error) throw error;
    }
  } catch (err) {
    console.error(err);
    return { error: err instanceof Error ? err.message : "L'enregistrement a échoué." };
  }

  changed();
  redirect("/recettes");
}

export async function deleteRecipe(recipeId: string) {
  await requireUser();
  const { data } = await db().from("recipes").select("photo_url").eq("id", recipeId).maybeSingle();
  await db().from("recipes").delete().eq("id", recipeId);
  const path = storagePath(data?.photo_url ?? null);
  if (path) await db().storage.from(BUCKET).remove([path]);
  changed();
  redirect("/recettes");
}
