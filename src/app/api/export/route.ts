import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Toutes les données de la famille, dans un fichier lisible (JSON) : membres et goûts,
 * recettes, swipes, courses. Les clés techniques des notifications n'y sont pas.
 */
export async function GET() {
  const user = await requireUser();
  const lire = async <T,>(requete: PromiseLike<{ data: T | null; error: { message: string } | null }>) => {
    const { data, error } = await requete;
    if (error) throw new Error(error.message);
    return data ?? ([] as T);
  };
  const famille = await lire(db().from("families").select("name, join_code, strict_dislikes, created_at").eq("id", user.familyId).maybeSingle());
  const membres = (await lire(
    db()
      .from("profiles")
      .select("id, name, emoji, style, envies, tastes_done_at, created_at, profile_tastes(food, level), push_subscriptions(user_agent, created_at)")
      .eq("family_id", user.familyId),
  )) as { id: string }[];
  const ids = membres.map((m) => m.id);
  const [recettes, swipes, courses] = await Promise.all([
    lire(db().from("recipes").select("*, recipe_ingredients(name, quantity, unit, aisle, position)").eq("family_id", user.familyId).order("title")),
    ids.length ? lire(db().from("swipes").select("*").in("profile_id", ids)) : [],
    lire(
      db()
        .from("shopping_trips")
        .select("*, trip_requests(*), trip_recipes(*), shopping_list_items(*)")
        .eq("family_id", user.familyId)
        .order("created_at", { ascending: false }),
    ),
  ]);
  const jour = new Date().toISOString().slice(0, 10);
  const contenu = { exporte_le: new Date().toISOString(), famille, membres, recettes, swipes, courses };
  return new NextResponse(JSON.stringify(contenu, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="kaddie-${jour}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
