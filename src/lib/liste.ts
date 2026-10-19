import "server-only";
import { db } from "@/lib/supabase/server";

/** Une ligne de liste à enregistrer (cle : l'identité du produit, origine : proposé par Kaddie). */
export type LigneArticle = {
  id?: string;
  trip_id: string;
  name: string;
  quantity: number | null;
  unit: string;
  aisle: string;
  source: "recipe" | "manual" | "request";
  for_recipes?: string | null;
  checked?: boolean;
  cle?: string | null;
  origine?: "habituel" | "reporte" | null;
};

/**
 * Ajoute des articles en ignorant ceux déjà là : même identifiant (renvoyé deux fois)
 * ou même produit (deux téléphones au même moment). La base le garantit.
 */
export async function insererArticles(lignes: LigneArticle[]) {
  if (lignes.length === 0) return;
  const { error } = await db().rpc("ajouter_articles", { lignes });
  if (!error) return;
  if (error.code !== "PGRST202") throw new Error(error.message);
  // Base pas encore migrée : comme avant, sans clé ni origine.
  const anciennes = lignes.map(({ cle: _c, origine: _o, ...l }) => ({ ...l, id: l.id ?? crypto.randomUUID() }));
  const { error: refus } = await db().from("shopping_list_items").upsert(anciennes, { onConflict: "id", ignoreDuplicates: true });
  if (refus) throw new Error(refus.message);
}
