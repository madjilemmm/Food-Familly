/**
 * Marmiton (assets.afcdn.com) sert chaque photo à la largeur écrite dans son adresse :
 * « …_w1024h1024c1… » ou « …_w1024cx… ». Une vignette de 56 px n'a pas besoin de 1024 px.
 * Les autres photos (envoyées par la famille) restent telles quelles.
 */
export function photoALaTaille(url: string, largeur: number): string {
  if (!url.startsWith("https://assets.afcdn.com/")) return url;
  return url.replace(/_w\d+(h\d+)?(?=[a-z_.])/, (_, carre?: string) => `_w${largeur}${carre ? `h${largeur}` : ""}`);
}

/** Les photos envoyées par les familles (stockage Supabase). */
export const BUCKET_PHOTOS = "recipe-photos";

/** Le chemin d'une photo dans notre stockage ; null pour une photo venue d'ailleurs. */
export function cheminDansLeStockage(publicUrl: string | null): string | null {
  if (!publicUrl) return null;
  const marker = `/object/public/${BUCKET_PHOTOS}/`;
  const i = publicUrl.indexOf(marker);
  return i === -1 ? null : decodeURIComponent(publicUrl.slice(i + marker.length));
}
