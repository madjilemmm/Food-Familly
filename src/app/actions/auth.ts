"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { randomInt } from "node:crypto";
import { db } from "@/lib/supabase/server";
import { getProfile } from "@/lib/data";
import { requireFamily, requireUser, setSession } from "@/lib/auth";
import { SESSION_COOKIE, newSession, type Style } from "@/lib/session";
import { STARTER_RECIPES } from "@/lib/starter-recipes";
import { noterEtape } from "@/lib/etapes";
import { DETAILS_DE_DEPART } from "@/lib/starter-etapes";
import { BUCKET_PHOTOS, cheminDansLeStockage } from "@/lib/photos";
import { annulerInvitations, familleInvitee, jetonDe, noterEssaiRate, tropDEssais } from "@/lib/acces";
import { normalizeName } from "@/lib/domain/shopping-list";
import { foyerValide } from "@/lib/domain/foyer";
import { nomDeFamille } from "@/lib/domain/convives";
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
  if (await tropDEssais()) return { error: "Trop d'essais. Attends un quart d'heure avant de réessayer." };
  const saisie = String(formData.get("code") ?? "");
  // Un lien d'invitation collé dans le champ marche aussi (iPhone : l'appli installée ne voit pas Safari).
  const jeton = jetonDe(saisie);
  const code = jeton ? "" : await normalizeJoinCode(saisie);
  const family = jeton
    ? await familleInvitee(jeton)
    : code
      ? (await db().from("families").select("id").eq("join_code", code).maybeSingle()).data
      : null;
  if (!family) {
    await noterEssaiRate().catch(() => {});
    // Ralentit les essais au hasard.
    await new Promise((r) => setTimeout(r, 1000));
    return {
      error: jeton
        ? "Ce lien a expiré. Demande un nouveau lien, ou tape le code famille."
        : "Ce code ne correspond à aucune famille. Vérifiez-le auprès d'un membre.",
    };
  }
  await setSession(newSession(family.id));
  redirect("/profil");
}

/**
 * Depuis un lien d'invitation, en un écran : son prénom, et c'est tout. On entre dans la famille et on voit
 * tout de suite ce qu'on mange ce soir. Un prénom déjà dans la famille est la même personne qui revient
 * (sur un autre téléphone) : on la retrouve au lieu de la doubler.
 */
export async function rejoindreAvecPrenom(jeton: string, _prev: { error?: string; existant?: string }, formData: FormData): Promise<{ error?: string; existant?: string }> {
  if (await tropDEssais()) return { error: "Trop d'essais. Attends un quart d'heure avant de réessayer." };
  const famille = await familleInvitee(jeton);
  if (!famille) {
    await noterEssaiRate().catch(() => {});
    return { error: "Ce lien a expiré. Demande un nouveau lien, ou tape le code famille." };
  }
  const prenom = cleanText(formData.get("prenom"), 40);
  if (!prenom) return { error: "Indique ton prénom." };
  const { data: membres } = await db().from("profiles").select("id, name, style").eq("family_id", famille.id);
  const cle = (n: string) => normalizeName(n);
  const deja = (membres ?? []).find((m) => cle(String(m.name)) === cle(prenom));
  // Un prénom déjà dans la famille : est-ce la même personne qui revient, ou une autre qui porte le même prénom ? On le demande
  // (sans mot de passe, répondre « oui » à la place de quelqu'un d'autre donnerait accès à son profil).
  if (deja && formData.get("confirme") !== "1") return { existant: String(deja.name) };
  let profileId = deja?.id as string | undefined;
  const style: Style = deja ? cleanStyle(deja.style) : "fun";
  if (!profileId) {
    const { data, error } = await db()
      .from("profiles")
      .insert({ name: prenom, emoji: "😎", style, family_id: famille.id, sort_order: 100 })
      .select("id")
      .single();
    if (error || !data) return { error: "L'entrée a échoué. Réessaie." };
    profileId = data.id as string;
  }
  await setSession(newSession(famille.id, profileId, style));
  await noterEtape("invite_arrive");
  changed();
  redirect("/menu");
}

/**
 * Créer sa famille en quelques secondes : son prénom, et c'est tout (le nom de la famille
 * est facultatif). Les autres arrivent ensuite avec le lien d'invitation.
 */
export async function createFamily(_prev: { error?: string }, formData: FormData): Promise<{ error?: string }> {
  const prenom = cleanText(formData.get("prenom"), 40);
  if (!prenom) return { error: "Indique ton prénom." };
  const familyName = cleanText(formData.get("family_name"), 60) || nomDeFamille(prenom);
  // Combien à table (1 à 5+) : de quoi calibrer la première liste.
  const foyer = foyerValide(formData.get("foyer"), 6);

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

  const style: Style = "fun";
  const { data: me, error } = await db()
    .from("profiles")
    .insert({ name: prenom, emoji: "😎", style, family_id: familyId, sort_order: 0 })
    .select("id")
    .single();
  if (error || !me) {
    await db().from("families").delete().eq("id", familyId);
    return { error: "La création a échoué. Réessayez." };
  }
  await addStarterRecipes(familyId);
  // Base pas encore migrée : la colonne n'existe pas, le foyer se corrige alors depuis « Ce soir ».
  if (foyer) await db().from("families").update({ foyer }).eq("id", familyId);
  await noterEtape("famille_creee");

  await setSession(newSession(familyId, me.id as string, style));
  // Directement la réponse du soir : la question d'allergie se pose là, en un appui.
  redirect("/menu");
}

/** 10 recettes classiques pour qu'une nouvelle famille puisse swiper tout de suite. */
async function addStarterRecipes(familyId: string) {
  const { data: recipes } = await db()
    .from("recipes")
    .insert(
      STARTER_RECIPES.map(({ title, emoji }) => ({
        family_id: familyId,
        title,
        emoji,
        servings: 4,
        total_minutes: DETAILS_DE_DEPART[title]?.minutes ?? null,
        steps: DETAILS_DE_DEPART[title]?.steps ?? [],
      })),
    )
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
  redirect("/");
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
  redirect("/menu");
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
  await annulerInvitations(user.familyId);
  changed();
}

/**
 * Supprimer la famille et tout ce qu'elle contient (membres, goûts, recettes, courses,
 * notifications), pour tout le monde. Les photos envoyées partent d'abord du stockage.
 */
export async function deleteFamily() {
  const user = await requireUser();
  const { data: photos } = await db().from("recipes").select("photo_url").eq("family_id", user.familyId).not("photo_url", "is", null);
  const chemins = (photos ?? []).flatMap((r) => cheminDansLeStockage(r.photo_url as string) ?? []);
  if (chemins.length) await db().storage.from(BUCKET_PHOTOS).remove(chemins);
  const { error } = await db().from("families").delete().eq("id", user.familyId);
  if (error) throw new Error("La suppression a échoué. Réessaie.");
  // Les autres téléphones se rafraîchissent et voient que la famille n'existe plus.
  changed();
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/bienvenue");
}
