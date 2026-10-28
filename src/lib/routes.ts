/** Les écrans de l'appli : les mêmes pour tout le monde. */
export const ROUTES = {
  envies: "/envies",
  courses: "/courses",
  menu: "/menu",
  ceSoir: "/menu",
  liste: "/courses?vue=liste",
} as const;

/**
 * Anciennes adresses (styles « simple » et « fun », première version),
 * encore dans les notifications et les applis installées.
 */
const ANCIENNES: Record<string, string> = {
  "/simple": ROUTES.courses,
  "/simple/swipe": ROUTES.envies,
  "/simple/plats": ROUTES.menu,
  "/simple/liste": ROUTES.liste,
  "/fun": ROUTES.envies,
  "/fun/courses": ROUTES.courses,
  "/fun/matchs": ROUTES.menu,
  "/fun/liste": ROUTES.liste,
  "/liste": ROUTES.liste,
  "/matchs": ROUTES.menu,
  "/maman": ROUTES.courses,
  "/maman/plats": ROUTES.menu,
  "/maman/liste": ROUTES.liste,
  "/enfant": ROUTES.envies,
  "/enfant/courses": ROUTES.courses,
  "/enfant/matchs": ROUTES.menu,
};

export function resolveAlias(pathname: string): string | null {
  return ANCIENNES[pathname.replace(/\/$/, "")] ?? null;
}
