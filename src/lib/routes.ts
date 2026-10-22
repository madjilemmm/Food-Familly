/** Les écrans de l'appli : les mêmes pour tout le monde. */
export const ROUTES = {
  envies: "/envies",
  courses: "/courses",
  matchs: "/matchs",
  ceSoir: "/ce-soir",
  liste: "/courses?vue=liste",
} as const;

/**
 * Anciennes adresses (styles « simple » et « fun », première version),
 * encore dans les notifications et les applis installées.
 */
const ANCIENNES: Record<string, string> = {
  "/simple": ROUTES.courses,
  "/simple/swipe": ROUTES.envies,
  "/simple/plats": ROUTES.matchs,
  "/simple/liste": ROUTES.liste,
  "/fun": ROUTES.envies,
  "/fun/courses": ROUTES.courses,
  "/fun/matchs": ROUTES.matchs,
  "/fun/liste": ROUTES.liste,
  "/liste": ROUTES.liste,
  "/maman": ROUTES.courses,
  "/maman/plats": ROUTES.matchs,
  "/maman/liste": ROUTES.liste,
  "/enfant": ROUTES.envies,
  "/enfant/courses": ROUTES.courses,
  "/enfant/matchs": ROUTES.matchs,
};

export function resolveAlias(pathname: string): string | null {
  return ANCIENNES[pathname.replace(/\/$/, "")] ?? null;
}
