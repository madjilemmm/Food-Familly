import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, decodeSession, type Role, type Session } from "@/lib/session";

export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  return decodeSession(store.get(SESSION_COOKIE)?.value);
}

export type CurrentUser = { profileId: string; role: Role };

/**
 * À appeler au début de chaque server action / route : vérifie la session
 * et, si demandé, le rôle. Le middleware protège déjà les pages, mais les
 * actions peuvent être appelées directement.
 */
export async function requireUser(role?: Role): Promise<CurrentUser> {
  const session = await getSession();
  if (!session?.profileId || !session.role) redirect("/bienvenue");
  if (role && session.role !== role) throw new Error("Action non autorisée pour ce profil");
  return { profileId: session.profileId, role: session.role };
}
