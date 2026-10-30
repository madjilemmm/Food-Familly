"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { loadCurrentTrip } from "@/lib/data";
import { reconstruireListe } from "@/lib/menu";
import { db } from "@/lib/supabase/server";
import { BUCKET_PHOTOS, cheminDansLeStockage } from "@/lib/photos";
import { isAisle } from "@/lib/domain/aisles";
import { extractRecipe, type ImportedRecipe } from "@/lib/domain/recipe-import";
import { safeFetch } from "@/lib/safe-fetch";
import { changed, cleanText } from "./_shared";

const BUCKET = BUCKET_PHOTOS;
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
  const user = await requireUser();
  const id = cleanText(formData.get("id"), 64) || null;
  const title = cleanText(formData.get("title"), 120);
  const emoji = cleanText(formData.get("emoji"), 16) || "🍽️";
  const ingredients = parseIngredients(formData.get("ingredients"));
  const photo = formData.get("photo");
  const removePhoto = formData.get("remove_photo") === "1";
  const remotePhoto = cleanText(formData.get("photo_remote_url"), 2000);
  const servingsRaw = Math.round(Number(cleanText(formData.get("servings"), 4)));
  const servings = Number.isFinite(servingsRaw) && servingsRaw >= 1 && servingsRaw <= 50 ? servingsRaw : null;
  const steps = cleanText(formData.get("steps"), 20000)
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 40);
  const details = { servings, steps: steps.length ? steps : null };

  if (!title) return { error: "Donnez un nom à la recette." };

  let recipeId = id;
  let oldPhoto: string | null = null;
  const creee = !id;
  // Au Menu de la course en cours ? Alors sa liste d'articles doit suivre ce qui vient d'être enregistré.
  const course = id ? await loadCurrentTrip(user.familyId) : null;
  const auMenu = Boolean(course?.trip_recipes.some((r) => r.recipe_id === id && r.selected));

  try {
    if (recipeId) {
      const { data: existing } = await db()
        .from("recipes")
        .select("photo_url")
        .eq("id", recipeId)
        .eq("family_id", user.familyId)
        .maybeSingle();
      if (!existing) return { error: "Cette recette n'existe plus." };
      oldPhoto = existing.photo_url;
    } else {
      const { data, error } = await db().from("recipes").insert({ title, emoji, family_id: user.familyId, ...details }).select("id").single();
      if (error) throw error;
      recipeId = data.id as string;
    }

    // Photo : nouvelle, supprimée ou inchangée (envoyée maintenant, rattachée à la recette tout à la fin)
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

    // Ingrédients : les nouveaux sont écrits avant que les anciens soient retirés. Si une écriture échoue en route, la recette
    // garde ses ingrédients (jamais « plus d'ingrédients » avec un titre déjà changé).
    const { data: anciens } = await db().from("recipe_ingredients").select("id").eq("recipe_id", recipeId);
    let nouveaux: string[] = [];
    if (ingredients.length > 0) {
      const { data, error } = await db()
        .from("recipe_ingredients")
        .insert(ingredients.map((ing, position) => ({ ...ing, position, recipe_id: recipeId })))
        .select("id");
      if (error) throw error;
      nouveaux = (data ?? []).map((r) => r.id as string);
    }
    const aRetirer = (anciens ?? []).map((r) => r.id as string);
    if (aRetirer.length > 0) {
      const { error } = await db().from("recipe_ingredients").delete().in("id", aRetirer);
      if (error) {
        // La recette reste comme elle était : on retire ce qui vient d'être ajouté.
        if (nouveaux.length > 0) await db().from("recipe_ingredients").delete().in("id", nouveaux);
        throw error;
      }
    }

    // Le titre et le reste en dernier : une panne avant laisse la recette telle qu'elle était.
    if (!creee) {
      const { error } = await db()
        .from("recipes")
        .update({ title, emoji, ...details, ...(photoUrl !== undefined ? { photo_url: photoUrl } : {}) })
        .eq("id", recipeId)
        .eq("family_id", user.familyId);
      if (error) throw error;
    } else if (photoUrl !== undefined) {
      await db().from("recipes").update({ photo_url: photoUrl }).eq("id", recipeId);
    }
    if (photoUrl !== undefined) {
      const oldPath = cheminDansLeStockage(oldPhoto);
      if (oldPath) await db().storage.from(BUCKET).remove([oldPath]);
    }
    // Une recette du Menu modifiée : la liste suit (quantités, ingrédients, titre).
    if (auMenu) await reconstruireListe(user.familyId, course!.id).catch((err) => console.error("Liste non mise à jour après la recette :", err));
  } catch (err) {
    console.error(err);
    // Une recette créée à l'instant et pas terminée n'est pas gardée à moitié.
    if (creee && recipeId) await db().from("recipes").delete().eq("id", recipeId);
    return { error: err instanceof Error ? err.message : "L'enregistrement a échoué." };
  }

  changed();
  redirect("/recettes");
}

export async function deleteRecipe(recipeId: string) {
  const user = await requireUser();
  const { data } = await db()
    .from("recipes")
    .select("photo_url")
    .eq("id", recipeId)
    .eq("family_id", user.familyId)
    .maybeSingle();
  if (!data) return;
  const course = await loadCurrentTrip(user.familyId);
  const auMenu = Boolean(course?.trip_recipes.some((r) => r.recipe_id === recipeId && r.selected));
  await db().from("recipes").delete().eq("id", recipeId).eq("family_id", user.familyId);
  // Une recette du Menu supprimée : ses articles quittent la liste, le Menu ne la garde pas.
  if (auMenu) await reconstruireListe(user.familyId, course!.id).catch((err) => console.error("Liste non mise à jour après la suppression :", err));
  const path = cheminDansLeStockage(data?.photo_url ?? null);
  if (path) await db().storage.from(BUCKET).remove([path]);
  changed();
  redirect("/recettes");
}
