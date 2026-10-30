/**
 * L'API de la base ne renvoie que 1 000 lignes par requête, sans erreur ni avertissement : une famille très active
 * perdrait ses avis les plus anciens (ou, au-delà, ses recettes) sans que rien ne le dise. On lit par pages, jusqu'à tout avoir.
 */
export async function lirePages<T>(
  page: (de: number, a: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  taille = 1000,
): Promise<T[]> {
  const lignes: T[] = [];
  for (let debut = 0; ; debut += taille) {
    const { data, error } = await page(debut, debut + taille - 1);
    if (error) throw new Error(error.message);
    const lot = data ?? [];
    lignes.push(...lot);
    if (lot.length < taille) return lignes;
  }
}
