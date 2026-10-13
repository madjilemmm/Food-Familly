import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/supabase/server";
import { SESSION_COOKIE, cookieOptions, decodeAnySession, encodeSession, newSession, type Style } from "@/lib/session";

/**
 * Recrée le cookie à partir du profil en base :
 * - cookie de la première version (une seule famille) → nouveau format,
 *   sans redemander le code ;
 * - style d'interface changé depuis un autre appareil.
 */
export async function GET(req: NextRequest) {
  const nextParam = req.nextUrl.searchParams.get("next") ?? "/";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/";
  const session = await decodeAnySession(req.cookies.get(SESSION_COOKIE)?.value);

  const toWelcome = () => {
    const res = NextResponse.redirect(new URL("/bienvenue", req.url));
    res.cookies.delete(SESSION_COOKIE);
    return res;
  };
  if (!session?.profileId) return session && "v" in session ? NextResponse.redirect(new URL("/profil", req.url)) : toWelcome();

  let query = db().from("profiles").select("id, family_id, style").eq("id", session.profileId);
  if ("v" in session) query = query.eq("family_id", session.familyId);
  const { data: profile } = await query.maybeSingle();
  if (!profile) {
    if (!("v" in session)) return toWelcome();
    const res = NextResponse.redirect(new URL("/profil", req.url));
    res.cookies.set(SESSION_COOKIE, await encodeSession(newSession(session.familyId)), cookieOptions);
    return res;
  }

  const res = NextResponse.redirect(new URL(next, req.url));
  res.cookies.set(
    SESSION_COOKIE,
    await encodeSession(newSession(profile.family_id, profile.id, profile.style as Style)),
    cookieOptions,
  );
  return res;
}
