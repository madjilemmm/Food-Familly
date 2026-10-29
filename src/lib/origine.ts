/** La requête vient du site lui-même (ou n'annonce aucune origine : appel serveur, outil en ligne de commande). */
export function memeSite(req: Request): boolean {
  const origine = req.headers.get("origin");
  if (!origine) return true;
  try {
    return new URL(origine).host === req.headers.get("host");
  } catch {
    return false;
  }
}

/** L'adresse du site telle que l'appelant l'a utilisée (https://…, ou http://localhost en local). */
export function origineDuSite(h: Headers): string {
  const hote = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  return `${h.get("x-forwarded-proto") ?? (hote.startsWith("localhost") ? "http" : "https")}://${hote}`;
}
