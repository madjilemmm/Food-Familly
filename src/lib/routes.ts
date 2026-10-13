import type { Style } from "@/lib/session";

/** Les écrans de chaque style d'interface. */
export const ROUTES: Record<Style, { home: string; courses: string; matchs: string; liste: string }> = {
  simple: { home: "/simple", courses: "/simple", matchs: "/simple/plats", liste: "/simple/liste" },
  fun: { home: "/fun", courses: "/fun/courses", matchs: "/fun/matchs", liste: "/fun/liste" },
};

/**
 * Adresses neutres (utilisées par les notifications) et anciennes adresses
 * de la première version, traduites vers l'écran du bon style.
 */
const ALIASES: Record<string, keyof (typeof ROUTES)["simple"]> = {
  "/": "home",
  "/courses": "courses",
  "/matchs": "matchs",
  "/liste": "liste",
  "/maman": "courses",
  "/maman/plats": "matchs",
  "/maman/liste": "liste",
  "/enfant": "home",
  "/enfant/courses": "courses",
  "/enfant/matchs": "matchs",
};

export function resolveAlias(pathname: string, style: Style): string | null {
  const key = ALIASES[pathname.replace(/\/$/, "") || "/"];
  return key ? ROUTES[style][key] : null;
}

/** /simple/plats vu par quelqu'un en style fun → /fun/matchs, etc. */
export function equivalentFor(pathname: string, style: Style): string | null {
  const other: Style = style === "simple" ? "fun" : "simple";
  if (!pathname.startsWith(`/${other}`)) return null;
  const entry = Object.entries(ROUTES[other]).find(([key, path]) => key !== "home" && path === pathname);
  return entry ? ROUTES[style][entry[0] as keyof (typeof ROUTES)["simple"]] : pathname === `/${other}/swipe` ? "/fun" : ROUTES[style].home;
}
