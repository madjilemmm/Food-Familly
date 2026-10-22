import "server-only";
import { db } from "@/lib/supabase/server";
import { sendPush } from "@/lib/push";
import { formatTime } from "@/lib/domain/trip";
import { conflictsOf, getEtiquettes, getFamilySwipes, getProfilsGouts, getTasteContext } from "@/lib/data";
import { prediction } from "@/lib/domain/profil-gouts";
import { heureAParis } from "@/lib/domain/heure";

async function members(familyId: string) {
  const { data } = await db().from("profiles").select("id, name").eq("family_id", familyId);
  return data ?? [];
}

/** Quelqu'un part faire les courses : la liste est prête, les autres ont une dernière chance pour une envie. */
export async function notifyTripStarted(familyId: string, shopperId: string) {
  const all = await members(familyId);
  const shopper = all.find((m) => m.id === shopperId)?.name ?? "Quelqu'un";
  await sendPush(
    all.filter((m) => m.id !== shopperId).map((m) => m.id),
    {
      title: `${shopper} part faire les courses`,
      body: "Une envie ? Ajoute-la à la liste, ou swipe vite : un match va tout seul au Menu.",
      url: "/courses",
      tag: "trip",
    },
  );
}

/**
 * Nouveau match : seules les autres personnes qui ont envie du plat sont prévenues
 * (celle qui vient de swiper le voit déjà ; les autres ne sont pas concernées).
 */
export async function notifyMatch(familyId: string, recipeId: string, autres: string[], auMenu: boolean) {
  if (autres.length === 0) return;
  const recipe = await db().from("recipes").select("title").eq("id", recipeId).eq("family_id", familyId).maybeSingle();
  await sendPush(autres, { title: "C'est un match !", body: recipe.data?.title ? (auMenu ? `${recipe.data.title} : au Menu, les ingrédients sont sur la liste.` : recipe.data.title) : "", url: "/menu", tag: "match" });
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

/** « A, B et C » */
const enFrancais = (l: string[]) => (l.length > 1 ? `${l.slice(0, -1).join(", ")} et ${l[l.length - 1]}` : (l[0] ?? ""));

/**
 * Les courses sont finies : chacun apprend ce qui a été pris pour lui (une seule fois,
 * pas article par article), et peut dire merci d'un appui.
 */
export async function notifyCoursesFinies(familyId: string, shopperId: string, pris: Map<string, { pris: string[]; manquants: string[] }>) {
  const all = await members(familyId);
  const shopper = all.find((m) => m.id === shopperId)?.name ?? "Quelqu'un";
  await Promise.all(
    all
      .filter((m) => m.id !== shopperId)
      .map((m) => {
        const p = pris.get(m.id);
        const body = p?.pris.length
          ? `${shopper} a pris ${enFrancais(p.pris.slice(0, 4))}${p.manquants.length ? ` (pas trouvé : ${enFrancais(p.manquants.slice(0, 3))})` : ""}. Dis merci ?`
          : "Dis-lui merci d'un appui.";
        return sendPush([m.id], { title: `${shopper} a fait les courses`, body, url: "/courses", tag: "fini" });
      }),
  );
}

/** Un merci : la personne qui a fait les courses le reçoit. */
export async function notifyMerci(familyId: string, deQui: string, pourQui: string) {
  const all = await members(familyId);
  const nom = all.find((m) => m.id === deQui)?.name ?? "Quelqu'un";
  await sendPush([pourQui], { title: `${nom} te dit merci`, body: "Pour les courses.", url: "/courses", tag: `merci-${deQui}` });
}

/** « À table ! » : tout le monde sauf la personne qui cuisine. */
export async function notifyATable(familyId: string, cuisinierId: string, minutes: number, titre: string | null) {
  const all = await members(familyId);
  const nom = all.find((m) => m.id === cuisinierId)?.name ?? "Quelqu'un";
  await sendPush(
    all.filter((m) => m.id !== cuisinierId).map((m) => m.id),
    {
      title: minutes ? `À table dans ${minutes} min !` : "À table !",
      body: `${nom} a cuisiné${titre ? ` : ${titre}` : ""}. Tu arrives ?`,
      url: "/ce-soir",
      tag: "a-table",
    },
  );
}

/** Une réponse à « À table ! » : la personne qui cuisine la reçoit. */
export async function notifyReponseATable(familyId: string, deQui: string, cuisinierId: string, reponse: "arrive" | "retard") {
  const all = await members(familyId);
  const nom = all.find((m) => m.id === deQui)?.name ?? "Quelqu'un";
  await sendPush([cuisinierId], { title: reponse === "arrive" ? `${nom} arrive` : `${nom} : 5 min`, body: "", url: "/ce-soir", tag: `a-table-${deQui}` });
}

// ─── « Ta voix fait le match » ─────────────────────────────────────────

const JOUR = 86_400_000;
/** Une relance peut partir de 9 h à 21 h (heure de Paris), au plus une par 20 h et par personne. */
export const RELANCES = { DE: 9, A: 21, ECART_MS: 20 * 60 * 60 * 1000, BOF_RESPECTE_JOURS: 45 } as const;


/**
 * Quelqu'un vient d'avoir envie d'un plat dont personne d'autre n'a envie : un « Miam » de plus
 * et c'est un match. Les autres membres qui l'aimeraient sans doute sont prévenus, une seule fois
 * par plat, au plus une fois par jour, jamais la nuit ; pas ceux qui ont dit « bof » récemment,
 * ni ceux qui n'aiment pas un ingrédient. Sans la table « relances » (base pas encore migrée),
 * rien ne part : on ne peut pas garantir la limite.
 */
export async function relancerDernierVote(familyId: string, recipeId: string, deQui: string, now = new Date()) {
  const h = heureAParis(now);
  if (h < RELANCES.DE || h >= RELANCES.A) return;
  const [all, { data: recipe }, ctx, profils, etiquettes, avis] = await Promise.all([
    members(familyId),
    db().from("recipes").select("id, title").eq("id", recipeId).eq("family_id", familyId).maybeSingle(),
    getTasteContext(familyId),
    getProfilsGouts(familyId),
    getEtiquettes(familyId),
    getFamilySwipes(familyId),
  ]);
  if (!recipe) return;
  const avisRecette = avis.get(recipeId);
  const tags = etiquettes.get(recipeId) ?? [];
  const nom = all.find((m) => m.id === deQui)?.name ?? "Quelqu'un";
  const cibles = all.filter((m) => {
    if (m.id === deQui) return false;
    const a = avisRecette?.get(m.id);
    if (a && !a.liked && now.getTime() - a.swipedAt < RELANCES.BOF_RESPECTE_JOURS * JOUR) return false;
    const verdict = conflictsOf(ctx, recipe as { id: string; title: string }, m.id).verdict;
    if (verdict === "cache" || verdict === "fin") return false;
    const note = prediction(profils.get(m.id) ?? new Map(), tags);
    return note == null || note >= 0;
  });
  for (const m of cibles) {
    const { count, error } = await db()
      .from("relances")
      .select("profile_id", { count: "exact", head: true })
      .eq("profile_id", m.id)
      .gte("envoyee_le", new Date(now.getTime() - RELANCES.ECART_MS).toISOString());
    if (error) return;
    if (count) continue;
    // Réservée avant l'envoi : une seule fois par plat, même si deux swipes arrivent ensemble.
    const { data: reservee } = await db()
      .from("relances")
      .upsert({ profile_id: m.id, recipe_id: recipeId, envoyee_le: now.toISOString() }, { onConflict: "profile_id,recipe_id", ignoreDuplicates: true })
      .select("profile_id");
    if (!reservee?.length) continue;
    await sendPush([m.id], {
      title: "Ta voix fait le match",
      body: `${nom} a envie de ${recipe.title} : un « Miam » et c'est un match.`,
      url: "/envies",
      tag: `voix-${recipeId}`,
    });
  }
}
