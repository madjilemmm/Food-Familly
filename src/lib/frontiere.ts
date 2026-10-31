import "server-only";
import { db } from "@/lib/supabase/server";

/*
 * La frontière d'exploration de l'import (table import_frontiere) : les adresses de recettes déjà découvertes et ce qu'on en a décidé.
 * Chaque page lue révèle une vingtaine de voisines : on les met en file, on ne relit jamais une page déjà jugée.
 * Tant que la migration n'est pas passée, `lireFrontiere` renvoie null et l'import fonctionne comme avant (sans mémoire).
 */

const PAR_LOT = 400;
const lots = <T,>(xs: T[]) => Array.from({ length: Math.ceil(xs.length / PAR_LOT) }, (_, i) => xs.slice(i * PAR_LOT, (i + 1) * PAR_LOT));

export type Frontiere = {
  /** Découvertes, pas encore lues. */
  aVoir: string[];
  /** Tout ce qui est déjà connu (à voir, rejeté, retenu) : on ne le redécouvre pas. */
  connus: Set<string>;
  /** Les pages dont on a déjà lu les voisines. */
  explorees: Set<string>;
};

export async function lireFrontiere(familyId: string): Promise<Frontiere | null> {
  // Supabase ne renvoie pas plus de 1 000 lignes par requête : on lit page par page.
  const lignes: { url: string; etat: string; explore: boolean }[] = [];
  for (let debut = 0; debut < 30_000; debut += 1000) {
    const { data, error } = await db().from("import_frontiere").select("url, etat, explore").eq("family_id", familyId).order("url").range(debut, debut + 999);
    if (error) return null;
    lignes.push(...((data ?? []) as { url: string; etat: string; explore: boolean }[]));
    if ((data ?? []).length < 1000) break;
  }
  return {
    aVoir: lignes.filter((l) => l.etat === "a_voir").map((l) => l.url),
    connus: new Set(lignes.map((l) => l.url)),
    explorees: new Set(lignes.filter((l) => l.explore).map((l) => l.url)),
  };
}

/** De nouvelles adresses à voir (celles déjà connues sont ignorées). */
export async function ajouterALaFrontiere(familyId: string, urls: string[]) {
  for (const lot of lots([...new Set(urls)])) {
    await db().from("import_frontiere").upsert(lot.map((url) => ({ family_id: familyId, url })), { onConflict: "family_id,url", ignoreDuplicates: true });
  }
}

/** Ce qu'on a décidé de pages lues : retenues ou rejetées (leurs voisines ont été lues : `explore`). */
export async function jugerDesPages(familyId: string, urls: string[], etat: "retenu" | "rejete") {
  for (const lot of lots(urls)) {
    await db().from("import_frontiere").upsert(lot.map((url) => ({ family_id: familyId, url, etat, explore: true })), { onConflict: "family_id,url" });
  }
}

/** Écartées sans être lues (titre trop proche d'un plat de la famille) : jamais reconsidérées. */
export async function ecarter(familyId: string, urls: string[]) {
  for (const lot of lots(urls)) {
    await db().from("import_frontiere").upsert(lot.map((url) => ({ family_id: familyId, url, etat: "rejete" as const })), { onConflict: "family_id,url" });
  }
}

/** Les voisines de ces recettes déjà retenues ont été lues (graines d'exploration). */
export async function marquerExplorees(familyId: string, urls: string[]) {
  for (const lot of lots(urls)) {
    await db().from("import_frontiere").upsert(lot.map((url) => ({ family_id: familyId, url, etat: "retenu" as const, explore: true })), { onConflict: "family_id,url" });
  }
}

/** Pages impossibles à lire : on réessaie une fois, puis on abandonne. */
export async function pagesIllisibles(familyId: string, urls: string[]) {
  if (urls.length === 0) return;
  const { data } = await db().from("import_frontiere").select("url, essais").eq("family_id", familyId).in("url", urls);
  const essais = new Map((data ?? []).map((l) => [l.url as string, l.essais as number]));
  for (const lot of lots(urls)) {
    await db()
      .from("import_frontiere")
      .upsert(
        lot.map((url) => ({ family_id: familyId, url, essais: (essais.get(url) ?? 0) + 1, etat: (essais.get(url) ?? 0) + 1 >= 2 ? ("rejete" as const) : ("a_voir" as const) })),
        { onConflict: "family_id,url" },
      );
  }
}
