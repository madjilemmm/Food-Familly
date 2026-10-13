import "server-only";
import { db } from "@/lib/supabase/server";
import { sendPush } from "@/lib/push";
import { formatTime } from "@/lib/domain/trip";

async function members(familyId: string) {
  const { data } = await db().from("profiles").select("id, name").eq("family_id", familyId);
  return data ?? [];
}

/** Quelqu'un part faire les courses : on prévient tous les autres. */
export async function notifyTripStarted(familyId: string, shopperId: string, deadline: string) {
  const all = await members(familyId);
  const shopper = all.find((m) => m.id === shopperId)?.name ?? "Quelqu'un";
  await sendPush(
    all.filter((m) => m.id !== shopperId).map((m) => m.id),
    {
      title: `🛒 ${shopper} part faire les courses`,
      body: `Dis-lui ce que tu veux manger avant ${formatTime(deadline)} !`,
      url: "/courses",
      tag: "trip",
    },
  );
}

/** Un membre a répondu : on prévient la personne qui fait les courses. */
export async function notifyRequestReceived(
  familyId: string,
  shopperId: string | null,
  memberId: string,
  freeText: string | null,
  recipeCount: number,
) {
  if (!shopperId) return;
  const all = await members(familyId);
  const name = all.find((m) => m.id === memberId)?.name ?? "Quelqu'un";
  const parts: string[] = [];
  if (recipeCount > 0) parts.push(recipeCount === 1 ? "1 plat" : `${recipeCount} plats`);
  if (freeText) parts.push(`« ${freeText.slice(0, 80)} »`);
  await sendPush([shopperId], { title: `${name} a répondu`, body: parts.join(" et "), url: "/courses", tag: `request-${memberId}` });
}

/** Nouveau match : on prévient le reste de la famille (celui qui vient de swiper le voit déjà). */
export async function notifyMatch(familyId: string, swiperId: string, recipeId: string) {
  const [all, recipe] = await Promise.all([
    members(familyId),
    db().from("recipes").select("title").eq("id", recipeId).maybeSingle(),
  ]);
  await sendPush(
    all.filter((m) => m.id !== swiperId).map((m) => m.id),
    { title: "🎉 Nouveau match !", body: recipe.data?.title ?? "", url: "/matchs", tag: "match" },
  );
}
