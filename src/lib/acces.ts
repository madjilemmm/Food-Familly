import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { db } from "@/lib/supabase/server";

/*
 * Entrer dans une famille : par son code, ou par un lien d'invitation.
 * - Les essais de code ratés sont comptés par appareil : au-delà de ESSAIS_MAX en
 *   FENETRE_MIN minutes, il faut attendre. Deviner un code devient impraticable.
 * - Un lien d'invitation est valable DUREE_JOURS jours ; changer le code les annule tous.
 * Base pas encore migrée (tables absentes) : tout continue de marcher, sans ces protections.
 */

export const ESSAIS_MAX = 8;
const FENETRE_MIN = 15;
const DUREE_JOURS = 7;
/** À moins de 2 jours de la fin, on partage plutôt un nouveau lien. */
const RENOUVELER_AVANT_JOURS = 2;
const JOUR = 86_400_000;

const JETON = /^[0-9a-f]{32}$/;

/** Un lien collé (« …/rejoindre/<jeton> ») ou le jeton seul ; null si ce n'en est pas un. */
export function jetonDe(saisie: string): string | null {
  const brut = saisie.trim();
  const m = brut.match(/rejoindre\/([0-9a-f]{32})\b/i) ?? brut.match(/^([0-9a-f]{32})$/i);
  return m ? m[1].toLowerCase() : null;
}

export const cheminInvitation = (jeton: string) => `/rejoindre/${jeton}`;

// ─── Essais de code ────────────────────────────────────────────────────

/** L'appareil, sans garder son adresse : une empreinte salée par le secret de l'appli. */
async function cleAppareil(): Promise<string> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "inconnu";
  return createHash("sha256").update(`${process.env.SESSION_SECRET ?? ""}:${ip}`).digest("hex").slice(0, 32);
}

export async function tropDEssais(): Promise<boolean> {
  const depuis = new Date(Date.now() - FENETRE_MIN * 60_000).toISOString();
  const { count, error } = await db()
    .from("essais_code")
    .select("id", { count: "exact", head: true })
    .eq("cle", await cleAppareil())
    .gte("created_at", depuis);
  return !error && (count ?? 0) >= ESSAIS_MAX;
}

export async function noterEssaiRate() {
  await db().from("essais_code").insert({ cle: await cleAppareil() });
  // Ménage : un essai de plus d'un jour ne sert plus à rien.
  await db().from("essais_code").delete().lt("created_at", new Date(Date.now() - JOUR).toISOString());
}

// ─── Liens d'invitation ────────────────────────────────────────────────

export type Invitation = { jeton: string; expiresAt: string };

/** Le lien à partager : celui en cours s'il dure encore un peu, sinon un nouveau. */
export async function invitationAPartager(familyId: string, profileId: string): Promise<Invitation | null> {
  const { data, error } = await db()
    .from("invitations")
    .select("jeton, expires_at")
    .eq("family_id", familyId)
    .gt("expires_at", new Date(Date.now() + RENOUVELER_AVANT_JOURS * JOUR).toISOString())
    .order("expires_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return null;
  if (data) return { jeton: data.jeton as string, expiresAt: data.expires_at as string };
  const invitation = { jeton: randomBytes(16).toString("hex"), expiresAt: new Date(Date.now() + DUREE_JOURS * JOUR).toISOString() };
  const { error: refus } = await db()
    .from("invitations")
    .insert({ family_id: familyId, jeton: invitation.jeton, created_by: profileId, expires_at: invitation.expiresAt });
  return refus ? null : invitation;
}

/** La famille d'un lien encore valable, et le prénom de qui invite ; null s'il a expiré, été annulé ou n'existe pas. */
export async function familleInvitee(jeton: string): Promise<{ id: string; name: string; par: string | null } | null> {
  if (!JETON.test(jeton)) return null;
  const { data } = await db()
    .from("invitations")
    .select("created_by, families(id, name)")
    .eq("jeton", jeton)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  const ligne = data as { created_by: string | null; families: { id: string; name: string } | null } | null;
  if (!ligne?.families) return null;
  let par: string | null = null;
  if (ligne.created_by) {
    const { data: membre } = await db().from("profiles").select("name").eq("id", ligne.created_by).maybeSingle();
    par = (membre?.name as string | undefined) ?? null;
  }
  return { ...ligne.families, par };
}

/** Changer le code annule aussi les liens déjà envoyés. */
export async function annulerInvitations(familyId: string) {
  await db().from("invitations").delete().eq("family_id", familyId);
}
