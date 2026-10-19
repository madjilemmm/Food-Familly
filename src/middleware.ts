import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, cookieOptions, decodeAnySession, encodeSession } from "@/lib/session";
import { resolveAlias } from "@/lib/routes";

const WEEK = 7 * 24 * 60 * 60;
/** Accessibles sans famille : rejoindre ou créer une famille. */
const PUBLIC = ["/bienvenue", "/bienvenue/creer"];
/** Accessibles à tous, avec ou sans famille : un lien d'invitation, la page de confidentialité. */
const OUVERTES = (pathname: string) => pathname.startsWith("/rejoindre/") || pathname === "/confidentialite";
/** Accessibles avec une famille mais sans profil choisi. */
const NO_PROFILE = ["/profil", "/profil/nouveau"];

function redirect(req: NextRequest, path: string) {
  return NextResponse.redirect(new URL(path, req.url));
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  // Numéro de version de l'appli (mise à jour automatique) : rien de privé.
  if (pathname === "/api/version") return NextResponse.next();
  // Relances « plus que 10 min », appelées par Supabase sans session.
  if (pathname === "/api/cron/relance") return NextResponse.next();
  if (OUVERTES(pathname)) return NextResponse.next();
  const isApi = pathname.startsWith("/api/");
  const session = await decodeAnySession(req.cookies.get(SESSION_COOKIE)?.value);

  // Ancien cookie (première version) : converti sans redemander le code.
  if (session && !("v" in session)) {
    if (session.profileId && pathname !== "/api/session/refresh") {
      return redirect(req, `/api/session/refresh?next=${encodeURIComponent(pathname)}`);
    }
    if (pathname === "/api/session/refresh") return NextResponse.next();
    const res = PUBLIC.includes(pathname) ? NextResponse.next() : redirect(req, "/bienvenue");
    res.cookies.delete(SESSION_COOKIE);
    return res;
  }

  if (!session) {
    if (PUBLIC.includes(pathname)) return NextResponse.next();
    if (isApi) return NextResponse.json({ error: "Non connecté" }, { status: 401 });
    return redirect(req, "/bienvenue");
  }

  if (!session.profileId || !session.style) {
    if (NO_PROFILE.includes(pathname) || PUBLIC.includes(pathname)) return NextResponse.next();
    if (isApi) return NextResponse.json({ error: "Profil non choisi" }, { status: 401 });
    return redirect(req, "/profil");
  }

  if (PUBLIC.includes(pathname)) return redirect(req, "/");

  const alias = resolveAlias(pathname);
  if (alias) return redirect(req, alias);

  const res = NextResponse.next();
  // Prolonge la session des appareils utilisés régulièrement.
  const now = Math.floor(Date.now() / 1000);
  if (now - session.iat > WEEK) {
    res.cookies.set(SESSION_COOKIE, await encodeSession({ ...session, iat: now }), cookieOptions);
  }
  return res;
}

export const config = {
  // Tout sauf les fichiers statiques nécessaires avant connexion (PWA, icônes…).
  matcher: [
    "/((?!_next/|icons/|fonts/|brand/|sw\\.js|manifest\\.webmanifest|offline\\.html|favicon\\.ico|robots\\.txt).*)",
  ],
};
