"use server";

import { requireUser } from "@/lib/auth";
import { db } from "@/lib/supabase/server";
import { getAppris, getCurrentTrip } from "@/lib/data";
import { lireArticle, type Article } from "@/lib/domain/articles";
import { isAisle } from "@/lib/domain/aisles";
import { cleApprise, cleProduit } from "@/lib/domain/reconnaissance";
import { insererArticles } from "@/lib/liste";
import { changed } from "./_shared";

/** La liste appartient à la course en cours de la famille ; tout le monde peut la compléter. */
async function tripId() {
  const user = await requireUser();
  const trip = await getCurrentTrip(user.familyId);
  if (!trip) throw new Error("Aucune course en cours");
  return trip.id;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Cocher ou décocher, un article ou plusieurs d'un coup (la file d'attente du téléphone,
 * au retour du réseau). Chaque état est absolu : renvoyer deux fois ne change rien.
 */
export async function setItemsChecked(changes: { id: string; checked: boolean }[]) {
  const valides = changes.slice(0, 300).filter((c) => UUID.test(c.id) && typeof c.checked === "boolean");
  if (valides.length === 0) return;
  const trip = await tripId();
  const maj = (checked: boolean) => {
    const ids = valides.filter((c) => c.checked === checked).map((c) => c.id);
    return ids.length ? db().from("shopping_list_items").update({ checked }).in("id", ids).eq("trip_id", trip) : null;
  };
  const resultats = await Promise.all([maj(true), maj(false)]);
  const erreur = resultats.find((r) => r?.error)?.error;
  if (erreur) throw new Error(erreur.message);
  changed();
}

/** Un article lu sur le téléphone, vérifié avant d'être enregistré. */
function articleValide(a: unknown): Article | null {
  const x = a as Partial<Article> | null;
  if (!x || typeof x.name !== "string" || !x.name.trim()) return null;
  const quantity = typeof x.quantity === "number" && Number.isFinite(x.quantity) && x.quantity > 0 ? Math.round(x.quantity * 1000) / 1000 : null;
  return {
    name: x.name.trim().slice(0, 100),
    quantity,
    unit: typeof x.unit === "string" ? x.unit.trim().slice(0, 20) : "",
    aisle: isAisle(x.aisle) ? x.aisle : "autre",
  };
}

/**
 * Un ou plusieurs articles ; « 2 kg pommes » garde sa quantité, « PQ » devient Papier toilette.
 * Le téléphone envoie l'article tel qu'il l'a lu (et affiché) ; sinon le serveur le lit.
 * Un article créé sur le téléphone arrive avec son identifiant : renvoyé deux fois
 * (réseau revenu, appui répété), il n'est ajouté qu'une fois.
 */
export async function addItems(
  entries: (string | { id: string; texte: string; article?: Article })[],
  source: "manual" | "request" = "manual",
) {
  if (source !== "manual" && source !== "request") return;
  const user = await requireUser();
  const appris = await getAppris(user.familyId);
  const lignes = entries.slice(0, 20).flatMap((e) => {
    const { id, texte, article: lu } = typeof e === "string" ? { id: crypto.randomUUID(), texte: e, article: undefined } : e;
    const article = UUID.test(id) && typeof texte === "string" ? (articleValide(lu) ?? lireArticle(texte, appris)) : null;
    return article ? [{ id, ...article, source, cle: cleProduit(article.name, appris) }] : [];
  });
  if (lignes.length === 0) return;
  const trip = await tripId();
  await insererArticles(lignes.map((l) => ({ ...l, trip_id: trip })));
  changed();
}

export async function addItem(name: string, source: "manual" | "request" = "manual") {
  return addItems([name], source);
}

/**
 * Un article ajouté à la main disparaît ; un ingrédient de recette ou un article demandé
 * est mis de côté (« j'en ai déjà ») pour ne pas revenir à la prochaine mise à jour de la liste.
 */
export async function deleteItem(itemId: string, recette = false) {
  const trip = await tripId();
  const retire = recette
    ? await db().from("shopping_list_items").update({ source: "maison" }).eq("id", itemId).eq("trip_id", trip)
    : { error: null };
  // Base pas encore migrée (« maison » inconnu) : on supprime simplement.
  if (!recette || retire.error) await db().from("shopping_list_items").delete().eq("id", itemId).eq("trip_id", trip);
  changed();
}

/** « Annuler » après avoir retiré un ingrédient de recette ou un article demandé. */
export async function restoreItem(itemId: string, source: "recipe" | "request" = "recipe") {
  await db().from("shopping_list_items").update({ source }).eq("id", itemId).eq("trip_id", await tripId());
  changed();
}

/** Corriger un article déjà envoyé (choix d'une pastille, « Annuler » une correction). */
export async function corrigerArticle(itemId: string, article: Article) {
  const propre = articleValide(article);
  if (!UUID.test(itemId) || !propre) return;
  const trip = await tripId();
  const user = await requireUser();
  const cle = cleProduit(propre.name, await getAppris(user.familyId));
  let { error } = await db().from("shopping_list_items").update({ ...propre, cle }).eq("id", itemId).eq("trip_id", trip);
  // Base pas encore migrée (pas de clé), ou le produit choisi est déjà sur la liste : on corrige le nom seul.
  if (error) ({ error } = await db().from("shopping_list_items").update(propre).eq("id", itemId).eq("trip_id", trip));
  if (error?.code === "23505") await db().from("shopping_list_items").delete().eq("id", itemId).eq("trip_id", trip);
  else if (error) throw new Error(error.message);
  changed();
}

/** Ce que la famille apprend à Kaddie : « Kinder » = Kinder Bueno chez nous ; « nutela » reste tel quel. */
export async function apprendreArticle(saisie: string, choix: { nom: string; rayon: string; produit?: string } | "tel-quel") {
  const user = await requireUser();
  const cle = cleApprise(String(saisie).slice(0, 200));
  if (!cle) return;
  const ligne =
    choix === "tel-quel"
      ? { nom: null, rayon: null, produit: null, tel_quel: true }
      : { nom: String(choix.nom).trim().slice(0, 100), rayon: isAisle(choix.rayon) ? choix.rayon : "autre", produit: choix.produit?.slice(0, 60) ?? null, tel_quel: false };
  // Base pas encore migrée : on n'apprend rien, sans gêner l'ajout.
  await db()
    .from("produits_appris")
    .upsert({ family_id: user.familyId, saisie: cle, ...ligne, updated_at: new Date().toISOString() }, { onConflict: "family_id,saisie" });
}
