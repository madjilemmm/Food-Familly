import { NextResponse, type NextRequest } from "next/server";
import {
  SESSION_COOKIE,
  cookieOptions,
  decodeSession,
  encodeSession,
  type Role,
} from "@/lib/session";

const HOME: Record<Role, string> = { parent: "/maman", child: "/enfant" };
const WEEK = 7 * 24 * 60 * 60;

function redirect(req: NextRequest, path: string) {
  return NextResponse.redirect(new URL(path, req.url));
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const session = await decodeSession(req.cookies.get(SESSION_COOKIE)?.value);
  const isApi = pathname.startsWith("/api/");

  if (!session) {
    if (pathname === "/bienvenue") return NextResponse.next();
    if (isApi) return NextResponse.json({ error: "Non connecté" }, { status: 401 });
    return redirect(req, "/bienvenue");
  }

  if (pathname === "/bienvenue") return redirect(req, "/");

  if (!session.profileId || !session.role) {
    if (pathname === "/profil") return NextResponse.next();
    if (isApi) return NextResponse.json({ error: "Profil non choisi" }, { status: 401 });
    return redirect(req, "/profil");
  }

  const home = HOME[session.role];
  if (pathname === "/") return redirect(req, home);
  if (pathname.startsWith("/maman") && session.role !== "parent") return redirect(req, home);
  if (pathname.startsWith("/enfant") && session.role !== "child") return redirect(req, home);

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
    "/((?!_next/|icons/|sw\\.js|manifest\\.webmanifest|offline\\.html|favicon\\.ico|apple-touch-icon\\.png|robots\\.txt).*)",
  ],
};
