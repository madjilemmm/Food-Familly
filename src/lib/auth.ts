import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/data";
import { SESSION_COOKIE, cookieOptions, decodeSession, encodeSession, type Session, type Style } from "@/lib/session";

export const getSession = cache(async function getSession(): Promise<Session | null> {
  const store = await cookies();
  return decodeSession(store.get(SESSION_COOKIE)?.value);
});

export async function setSession(session: Session) {
  const store = await cookies();
  store.set(SESSION_COOKIE, await encodeSession(session), cookieOptions);
}

/** Famille rejointe (le profil n'est peut-être pas encore choisi). */
export async function requireFamily(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/bienvenue");
  return session;
}

export type CurrentUser = { profileId: string; familyId: string; style: Style };

/**
 * À appeler au début de chaque server action / route. Le middleware protège
 * déjà les pages, mais les actions peuvent être appelées directement.
 * Toutes les données sont ensuite filtrées par familyId.
 */
export async function requireUser(): Promise<CurrentUser> {
  const session = await getSession();
  if (!session?.profileId || !session.style) redirect("/bienvenue");
  return { profileId: session.profileId, familyId: session.familyId, style: session.style };
}

/** Le profil connecté (pour les pages). Renvoie au choix du profil s'il a disparu. */
export async function requireProfile() {
  const user = await requireUser();
  const profile = await getProfile(user.familyId, user.profileId);
  if (!profile) redirect("/profil");
  // Style changé depuis un autre appareil : on resynchronise le cookie.
  if (profile.style !== user.style) redirect("/api/session/refresh?next=/");
  return profile;
}
