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
      title: `${shopper} part faire les courses`,
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
    { title: "C'est un match !", body: recipe.data?.title ?? "", url: "/matchs", tag: "match" },
  );
}

/**
 * Plus que 10 minutes avant l'heure limite : on relance ceux qui n'ont pas
 * encore répondu. Une seule fois par course (reminded_at posé avant l'envoi).
 */
export async function sendDeadlineReminders(now = new Date()): Promise<number> {
  const dans10 = new Date(now.getTime() + 10 * 60 * 1000).toISOString();
  const { data: trips } = await db()
    .from("shopping_trips")
    .select("id, family_id, created_by, deadline_at, trip_requests(profile_id)")
    .eq("status", "open")
    .is("reminded_at", null)
    .gt("deadline_at", now.toISOString())
    .lte("deadline_at", dans10);
  let envoyees = 0;
  for (const trip of trips ?? []) {
    // Réserve la relance : si deux appels arrivent ensemble, un seul l'envoie.
    const { data: reservee } = await db()
      .from("shopping_trips")
      .update({ reminded_at: now.toISOString() })
      .eq("id", trip.id)
      .is("reminded_at", null)
      .select("id");
    if (!reservee?.length) continue;
    const all = await members(trip.family_id);
    const shopper = all.find((m) => m.id === trip.created_by)?.name ?? "Quelqu'un";
    const ontRepondu = new Set((trip.trip_requests as { profile_id: string }[]).map((r) => r.profile_id));
    const aRelancer = all.filter((m) => m.id !== trip.created_by && !ontRepondu.has(m.id)).map((m) => m.id);
    if (aRelancer.length === 0) continue;
    await sendPush(aRelancer, {
      title: "Plus que 10 min",
      body: `Dis à ${shopper} ce que tu veux manger avant ${formatTime(trip.deadline_at)}.`,
      url: "/courses",
      tag: "trip",
    });
    envoyees += aRelancer.length;
  }
  return envoyees;
}
