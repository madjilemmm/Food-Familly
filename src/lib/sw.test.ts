import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/** Le service worker, lu comme le navigateur le lit : un script qui s'abonne à des événements de `self`. */
function chargerSw(fenetres: { navigate?: (url: string) => void; focus: () => void }[] = []) {
  const gestionnaires: Record<string, (e: unknown) => void> = {};
  const ouvertes: string[] = [];
  const self = {
    location: { origin: "https://kaddie.test" },
    addEventListener: (type: string, f: (e: unknown) => void) => {
      gestionnaires[type] = f;
    },
    clients: {
      matchAll: async () => fenetres,
      openWindow: async (url: string) => void ouvertes.push(url),
      claim: async () => {},
    },
    skipWaiting: () => {},
  };
  new Function("self", "caches", readFileSync("public/sw.js", "utf8"))(self, {});
  return { gestionnaires, ouvertes };
}

/** Un clic sur une notification qui mène à `url`, et ce que le service worker fait ensuite. */
async function cliquer(sw: ReturnType<typeof chargerSw>, url: string | undefined) {
  const attentes: Promise<unknown>[] = [];
  sw.gestionnaires.notificationclick({ notification: { close() {}, data: url ? { url } : {} }, waitUntil: (p: Promise<unknown>) => attentes.push(p) });
  await Promise.all(attentes);
}

describe("Le clic sur une notification", () => {
  it("ouvre la page de la notification, marquée « via=notification » pour compter les retours", async () => {
    const sw = chargerSw();
    await cliquer(sw, "/courses");
    expect(sw.ouvertes).toEqual(["https://kaddie.test/courses?via=notification"]);
  });
  it("garde le reste de l'adresse (la page d'une recette sait d'où l'on vient avec « depuis »)", async () => {
    const sw = chargerSw();
    await cliquer(sw, "/recettes/abc?depuis=/menu");
    expect(sw.ouvertes).toEqual(["https://kaddie.test/recettes/abc?depuis=%2Fmenu&via=notification"]);
  });
  it("sans adresse : l'accueil", async () => {
    const sw = chargerSw();
    await cliquer(sw, undefined);
    expect(sw.ouvertes).toEqual(["https://kaddie.test/?via=notification"]);
  });
  it("une fenêtre de Kaddie déjà ouverte est ramenée sur cette page", async () => {
    const allees: string[] = [];
    let auPremierPlan = 0;
    const sw = chargerSw([{ navigate: (u) => void allees.push(u), focus: () => void auPremierPlan++ }]);
    await cliquer(sw, "/menu");
    expect(allees).toEqual(["https://kaddie.test/menu?via=notification"]);
    expect(auPremierPlan).toBe(1);
    expect(sw.ouvertes).toEqual([]);
  });
});
