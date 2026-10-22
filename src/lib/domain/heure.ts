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
