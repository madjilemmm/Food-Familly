/** Ce que montre l'aperçu d'un lien d'invitation (message, groupe de la famille) : rien de privé, un prénom et un plat. */
export type Apercu = { famille: string; par: string | null; plat: { titre: string; photo: string | null; articles: number } | null };

/** Le titre de l'aperçu : le plat de ce soir s'il est décidé, sinon qui invite. */
export const titreApercu = (a: Apercu | null) => (a?.plat ? `Ce soir : ${a.plat.titre}` : a ? `${a.par ? `${a.par} t'invite` : "Tu es invité·e"} sur Kaddie` : "Kaddie");

/** Ce que Kaddie a déjà fait, puis ce qu'on attend de la personne invitée : « Les 9 articles sont déjà dans le caddie. Dis-nous… » */
export function invitationAuPlat(articles: number): string {
  const fait = articles <= 0 ? "" : articles === 1 ? "L'article est déjà dans le caddie. " : `Les ${articles} articles sont déjà dans le caddie. `;
  return `${fait}Dis-nous ce qui te fait envie.`;
}

/** La ligne sous le titre de l'aperçu. */
export function texteApercu(a: Apercu | null): string {
  if (!a) return "On mange quoi ce soir ? Décidez à plusieurs, Kaddie remplit le caddie.";
  if (!a.plat) return "On décide ensemble quoi manger, et le caddie se remplit.";
  return invitationAuPlat(a.plat.articles);
}
