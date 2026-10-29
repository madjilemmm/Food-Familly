import { describe, expect, it } from "vitest";
import { invitationAuPlat, texteApercu, titreApercu, type Apercu } from "./apercu";

const sansPlat: Apercu = { famille: "Famille de Madji", par: "Madji", plat: null };
const avecPlat: Apercu = { famille: "Famille de Madji", par: "Madji", plat: { titre: "Blanquette de veau", photo: null, articles: 9 } };

describe("aperçu d'un lien d'invitation", () => {
  it("dit le plat de ce soir quand il est décidé, et combien d'articles attendent déjà", () => {
    expect(titreApercu(avecPlat)).toBe("Ce soir : Blanquette de veau");
    expect(texteApercu(avecPlat)).toBe("Les 9 articles sont déjà dans le caddie. Dis-nous ce qui te fait envie.");
  });
  it("accorde « article » quand il n'y en a qu'un, et se tait quand il n'y en a aucun", () => {
    expect(texteApercu({ ...avecPlat, plat: { ...avecPlat.plat!, articles: 1 } })).toBe("L'article est déjà dans le caddie. Dis-nous ce qui te fait envie.");
    expect(texteApercu({ ...avecPlat, plat: { ...avecPlat.plat!, articles: 0 } })).toBe("Dis-nous ce qui te fait envie.");
    expect(invitationAuPlat(9)).toBe("Les 9 articles sont déjà dans le caddie. Dis-nous ce qui te fait envie.");
  });
  it("sans plat décidé, dit qui invite", () => {
    expect(titreApercu(sansPlat)).toBe("Madji t'invite sur Kaddie");
    expect(titreApercu({ ...sansPlat, par: null })).toBe("Tu es invité·e sur Kaddie");
    expect(texteApercu(sansPlat)).toBe("On décide ensemble quoi manger, et le caddie se remplit.");
  });
  it("lien expiré : la promesse de Kaddie, sans rien de la famille", () => {
    expect(titreApercu(null)).toBe("Kaddie");
    expect(texteApercu(null)).toBe("On mange quoi ce soir ? Décidez à plusieurs, Kaddie remplit le caddie.");
  });
});
