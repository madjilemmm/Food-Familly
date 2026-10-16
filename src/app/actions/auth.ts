"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { randomInt } from "node:crypto";
import { db } from "@/lib/supabase/server";
import { getProfile } from "@/lib/data";
import { requireFamily, requireUser, setSession } from "@/lib/auth";
import { SESSION_COOKIE, newSession, type Style } from "@/lib/session";
import { STARTER_RECIPES } from "@/lib/starter-recipes";
import { cleanText, changed } from "./_shared";

const CODE_WORDS = [
  "quiche", "gratin", "crepe", "tajine", "couscous", "raclette", "fondue", "risotto", "lasagne", "paella",
  "tartiflette", "cassoulet", "omelette", "galette", "brioche", "clafoutis", "madeleine", "pistou", "ratatouille", "pizza",
  "burger", "sushi", "tacos", "curry", "soupe", "tomate", "carotte", "cerise", "banane", "citron",
];

/** « Quiche 5974 », « QUICHE-5974 » et « quiche-5974 » sont le même code. */
export async function normalizeJoinCode(code: string): Promise<string> {
  return code
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[\s_]+/g, "-");
}

function generateJoinCode() {
  const word = () => CODE_WORDS[randomInt(CODE_WORDS.length)];
  return `${word()}-${randomInt(1000, 10000)}-${word()}`;
}

function cleanStyle(value: unknown): Style {
  return value === "simple" ? "simple" : "fun";
}

function cleanEmoji(value: unknown, fallback = "🙂") {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 16) : fallback;
}

// ─── Rejoindre ou créer une famille ────────────────────────────────────

export async function joinFamily(_prev: { error?: string }, formData: FormData): Promise<{ error?: string }> {
  const code = await normalizeJoinCode(String(formData.get("code") ?? ""));
  const { data: family } = code
    ? await db().from("families").select("id").eq("join_code", code).maybeSingle()
    : { data: null };
  if (!family) {
    // Ralentit les essais au hasard.
    await new Promise((r) => setTimeout(r, 1000));
    return { error: "Ce code ne correspond à aucune famille. Vérifiez-le auprès d'un membre." };
  }
  await setSession(newSession(family.id));
  redirect("/profil");
}

type NewMember = { name: string; emoji: string; style: Style };

export async function createFamily(_prev: { error?: string }, formData: FormData): Promise<{ error?: string }> {
  const familyName = cleanText(formData.get("family_name"), 60);
  let members: NewMember[] = [];
  try {
    const raw = JSON.parse(String(formData.get("members") ?? "[]")) as unknown[];
    members = raw.slice(0, 20).flatMap((m) => {
      const item = m as Record<string, unknown>;
      const name = typeof item?.name === "string" ? item.name.trim().slice(0, 40) : "";
      return name ? [{ name, emoji: cleanEmoji(item.emoji), style: cleanStyle(item.style) }] : [];
    });
  } catch {
    members = [];
  }
  const meIndex = Number(formData.get("me") ?? 0);

  if (!familyName) return { error: "Donnez un nom à votre famille." };
  if (members.length === 0) return { error: "Ajoutez au moins une personne." };
  if (!(meIndex >= 0 && meIndex < members.length)) return { error: "Indiquez qui vous êtes dans la liste." };

  // Code unique (on réessaie en cas de collision, très improbable).
  let familyId: string | null = null;
  for (let attempt = 0; attempt < 5 && !familyId; attempt++) {
    const { data, error } = await db()
      .from("families")
      .insert({ name: familyName, join_code: generateJoinCode() })
      .select("id")
      .single();
    if (data) familyId = data.id as string;
    else if (error && !error.message.includes("duplicate")) return { error: "La création a échoué. Réessayez." };
  }
  if (!familyId) return { error: "La création a échoué. Réessayez." };

  const { data: profiles, error } = await db()
    .from("profiles")
    .insert(members.map((m, i) => ({ ...m, family_id: familyId, sort_order: i })))
    .select("id, sort_order");
  if (error || !profiles) {
    await db().from("families").delete().eq("id", familyId);
    return { error: "La création a échoué. Réessayez." };
  }
  await addStarterRecipes(familyId);

  const me = profiles.find((p) => p.sort_order === meIndex)!;
  await setSession(newSession(familyId, me.id as string, members[meIndex].style));
  redirect(`/profil/gouts?suite=${encodeURIComponent("/famille?bienvenue=1")}`);
}

/** 10 recettes classiques pour qu'une nouvelle famille puisse swiper tout de suite. */
async function addStarterRecipes(familyId: string) {
  const { data: recipes } = await db()
    .from("recipes")
    .insert(STARTER_RECIPES.map(({ title, emoji }) => ({ family_id: familyId, title, emoji })))
    .select("id, title");
  if (!recipes) return;
  const idByTitle = new Map(recipes.map((r) => [r.title as string, r.id as string]));
  await db()
    .from("recipe_ingredients")
    .insert(
      STARTER_RECIPES.flatMap((r) =>
        r.ingredients.map((ing, position) => ({ ...ing, position: position + 1, recipe_id: idByTitle.get(r.title) })),
      ),
    );
}

// ─── Choisir son profil ────────────────────────────────────────────────

export async function chooseProfile(profileId: string) {
  const session = await requireFamily();
  const profile = await getProfile(session.familyId, profileId);
  if (!profile) throw new Error("Profil introuvable");
  await setSession(newSession(session.familyId, profile.id, profile.style));
  // Première fois sur ce profil : le questionnaire de goûts d'abord.
  redirect(profile.tastes_seen_at ? "/" : "/profil/gouts");
}

/** « Je ne suis pas dans la liste » : on s'ajoute soi-même à la famille. */
export async function addMyself(_prev: { error?: string }, formData: FormData): Promise<{ error?: string }> {
  const session = await requireFamily();
  const name = cleanText(formData.get("name"), 40);
  if (!name) return { error: "Indiquez votre prénom." };
  const style = cleanStyle(formData.get("style"));
  const { data, error } = await db()
    .from("profiles")
    .insert({ family_id: session.familyId, name, emoji: cleanEmoji(formData.get("emoji")), style, sort_order: 100 })
    .select("id")
    .single();
  if (error || !data) return { error: "L'ajout a échoué. Réessayez." };
  await setSession(newSession(session.familyId, data.id as string, style));
  changed();
  redirect("/profil/gouts");
}

export async function forgetProfile() {
  const session = await requireFamily();
  await setSession(newSession(session.familyId));
  redirect("/profil");
}

export async function leaveFamily() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  redirect("/bienvenue");
}

// ─── Gérer les membres (tout membre de la famille peut le faire) ───────

export async function saveMember(_prev: { error?: string; ok?: boolean }, formData: FormData): Promise<{ error?: string; ok?: boolean }> {
  const user = await requireUser();
  const id = cleanText(formData.get("id"), 64) || null;
  const name = cleanText(formData.get("name"), 40);
  if (!name) return { error: "Indiquez un prénom." };
  const fields = { name, emoji: cleanEmoji(formData.get("emoji")), style: cleanStyle(formData.get("style")) };

  if (id) {
    const { error } = await db().from("profiles").update(fields).eq("id", id).eq("family_id", user.familyId);
    if (error) return { error: "L'enregistrement a échoué." };
    // Mon propre style a changé : le cookie doit suivre.
    if (id === user.profileId && fields.style !== user.style) {
      await setSession(newSession(user.familyId, user.profileId, fields.style));
    }
  } else {
    const { error } = await db().from("profiles").insert({ ...fields, family_id: user.familyId, sort_order: 100 });
    if (error) return { error: "L'ajout a échoué." };
  }
  changed();
  return { ok: true };
}

export async function removeMember(profileId: string) {
  const user = await requireUser();
  if (profileId === user.profileId) throw new Error("Vous ne pouvez pas vous retirer vous-même.");
  await db().from("profiles").delete().eq("id", profileId).eq("family_id", user.familyId);
  changed();
}

export async function renameFamily(name: string) {
  const user = await requireUser();
  const clean = name.trim().slice(0, 60);
  if (!clean) return;
  await db().from("families").update({ name: clean }).eq("id", user.familyId);
  changed();
}

export async function regenerateJoinCode() {
  const user = await requireUser();
  for (let attempt = 0; attempt < 5; attempt++) {
    const { error } = await db().from("families").update({ join_code: generateJoinCode() }).eq("id", user.familyId);
    if (!error) break;
  }
  changed();
}
