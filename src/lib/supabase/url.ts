/**
 * Nettoie l'URL Supabase copiée depuis le tableau de bord : espaces,
 * "/" final ou suffixe "/rest/v1" (l'URL de l'API REST au lieu de celle
 * du projet) font sinon échouer toutes les requêtes.
 */
export function normalizeSupabaseUrl(raw: string): string {
  return raw
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/(rest|auth|storage|realtime)\/v1$/, "")
    .replace(/\/+$/, "");
}
