/**
 * L'heure à Paris (0-23). Par morceaux : en français, l'heure seule s'écrit « 17 h »,
 * qu'on ne peut pas lire comme un nombre.
 */
export function heureAParis(d: Date = new Date()): number {
  const h = new Intl.DateTimeFormat("fr-FR", { hour: "numeric", hour12: false, timeZone: "Europe/Paris" })
    .formatToParts(d)
    .find((p) => p.type === "hour")?.value;
  return Number(h) % 24;
}

/** Le jour à Paris, « 2026-10-28 » : le même pour toute la famille, quel que soit le fuseau du serveur. */
export function jourAParis(d: Date = new Date()): string {
  const morceaux = new Intl.DateTimeFormat("fr-FR", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Europe/Paris" }).formatToParts(d);
  const v = (type: string) => morceaux.find((m) => m.type === type)?.value ?? "";
  return `${v("year")}-${v("month")}-${v("day")}`;
}
