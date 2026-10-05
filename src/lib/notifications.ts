import "server-only";
import { db } from "@/lib/supabase/server";
import { sendPush } from "@/lib/push";
import { formatTime } from "@/lib/domain/trip";

async function profilesByRole(role: "parent" | "child") {
  const { data } = await db().from("profiles").select("id, name").eq("role", role);
  return data ?? [];
}

async function profileName(id: string) {
  const { data } = await db().from("profiles").select("name").eq("id", id).maybeSingle();
  return data?.name ?? "Quelqu'un";
}

/** Maman part : on prévient les fils. */
export async function notifyTripStarted(deadline: string) {
  const [children, parents] = await Promise.all([profilesByRole("child"), profilesByRole("parent")]);
  const mom = parents[0]?.name ?? "Maman";
  await sendPush(
    children.map((c) => c.id),
    {
      title: `🛒 ${mom} part faire les courses`,
      body: `Dis-lui ce que tu veux manger avant ${formatTime(deadline)} !`,
      url: "/enfant/courses",
      tag: "trip",
    },
  );
}

/** Un fils a répondu : on prévient maman. */
export async function notifyRequestReceived(childId: string, freeText: string | null, recipeCount: number) {
  const [name, parents] = await Promise.all([profileName(childId), profilesByRole("parent")]);
  const parts: string[] = [];
  if (recipeCount > 0) parts.push(recipeCount === 1 ? "1 plat" : `${recipeCount} plats`);
  if (freeText) parts.push(`« ${freeText.slice(0, 80)} »`);
  await sendPush(
    parents.map((p) => p.id),
    { title: `${name} a répondu`, body: parts.join(" et "), url: "/maman", tag: `request-${childId}` },
  );
}

/** Nouveau match : on prévient l'autre fils (celui qui vient de swiper le voit déjà). */
export async function notifyMatch(childId: string, recipeId: string) {
  const [children, recipe] = await Promise.all([
    profilesByRole("child"),
    db().from("recipes").select("title").eq("id", recipeId).maybeSingle(),
  ]);
  await sendPush(
    children.filter((c) => c.id !== childId).map((c) => c.id),
    { title: "🎉 Nouveau match !", body: recipe.data?.title ?? "", url: "/enfant/matchs", tag: "match" },
  );
}
