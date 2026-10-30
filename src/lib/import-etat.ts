import "server-only";
import { db } from "@/lib/supabase/server";
import { etatDeLaSource, prochainEssai, termesAEviter, type EtatSource, type Resultat } from "@/lib/domain/import-etat";

/*
 * Le verrou et la mémoire de l'import de nouvelles recettes (table import_decouverte), partagés par tous les serveurs.
 * Tant que la migration n'est pas passée, un verrou et un délai en mémoire (un seul serveur) prennent le relais.
 */

const enMemoire = new Map<string, { verrouJusqua: number; prochain: number; essaisVides: number; resultat: Resultat | null }>();

export type EtatImport = { etat: EtatSource; prochainEssai: number | null; essaisVides: number; termesAEviter: Set<string> };

export async function lireEtatImport(familyId: string): Promise<EtatImport> {
  const maintenant = Date.now();
  const { data, error } = await db().from("import_decouverte").select("verrou_jusqu, prochain_essai, essais_vides, dernier_resultat, termes_vides").eq("family_id", familyId).maybeSingle();
  if (error) {
    const m = enMemoire.get(familyId);
    return {
      etat: etatDeLaSource(m ? { verrouJusqua: m.verrouJusqua, essaisVides: m.essaisVides, dernierResultat: m.resultat, maintenant } : null),
      prochainEssai: m?.prochain ?? null,
      essaisVides: m?.essaisVides ?? 0,
      termesAEviter: new Set(),
    };
  }
  if (!data) return { etat: "ok", prochainEssai: null, essaisVides: 0, termesAEviter: new Set() };
  return {
    etat: etatDeLaSource({
      verrouJusqua: data.verrou_jusqu ? Date.parse(data.verrou_jusqu as string) : null,
      essaisVides: data.essais_vides as number,
      dernierResultat: data.dernier_resultat as Resultat | null,
      maintenant,
    }),
    prochainEssai: data.prochain_essai ? Date.parse(data.prochain_essai as string) : null,
    essaisVides: data.essais_vides as number,
    termesAEviter: termesAEviter((data.termes_vides as Record<string, string>) ?? {}, maintenant),
  };
}

/** Un seul import à la fois pour une famille, et pas avant le délai prévu. « pris » : à vous ; « refuse » : un autre import tourne ou il est trop tôt. */
export async function prendreLeVerrou(familyId: string, dureeMs: number): Promise<"pris" | "refuse"> {
  const maintenant = Date.now();
  const iso = (t: number) => new Date(t).toISOString();
  const { error } = await db().from("import_decouverte").upsert({ family_id: familyId }, { onConflict: "family_id", ignoreDuplicates: true });
  if (error) {
    const m = enMemoire.get(familyId);
    if (m && (m.verrouJusqua > maintenant || m.prochain > maintenant)) return "refuse";
    enMemoire.set(familyId, { verrouJusqua: maintenant + dureeMs, prochain: m?.prochain ?? 0, essaisVides: m?.essaisVides ?? 0, resultat: m?.resultat ?? null });
    return "pris";
  }
  const { data: ligne } = await db().from("import_decouverte").select("prochain_essai").eq("family_id", familyId).maybeSingle();
  if (ligne?.prochain_essai && Date.parse(ligne.prochain_essai as string) > maintenant) return "refuse";
  // Le verrou se prend par une mise à jour conditionnelle (une seule passe quand deux serveurs essaient en même temps), puis on RELIT le jeton :
  // on ne s'appuie pas sur les lignes renvoyées par la mise à jour, que PostgREST vide quand le filtre porte sur la colonne qu'on modifie.
  const jeton = crypto.randomUUID();
  await db()
    .from("import_decouverte")
    .update({ verrou_jusqu: iso(maintenant + dureeMs), verrou_jeton: jeton })
    .eq("family_id", familyId)
    .or(`verrou_jusqu.is.null,verrou_jusqu.lt.${iso(maintenant)}`);
  const { data: apres } = await db().from("import_decouverte").select("verrou_jeton").eq("family_id", familyId).maybeSingle();
  return apres?.verrou_jeton === jeton ? "pris" : "refuse";
}

/** Fin d'un import : le verrou est rendu, le prochain essai est planifié, les recherches qui n'ont rien donné sont notées. */
export async function terminerImport(familyId: string, resultat: Resultat, ajoutees: number, termesVides: string[]) {
  const maintenant = Date.now();
  const { data } = await db().from("import_decouverte").select("essais_vides, ajoutees_total, termes_vides").eq("family_id", familyId).maybeSingle();
  const vides = resultat === "ajoutees" ? 0 : ((data?.essais_vides as number | undefined) ?? enMemoire.get(familyId)?.essaisVides ?? 0) + 1;
  const prochain = prochainEssai(resultat, vides, maintenant);
  const memoire = { ...((data?.termes_vides as Record<string, string>) ?? {}) };
  for (const t of termesVides) memoire[t] = new Date(maintenant).toISOString();
  // On ne garde que les recherches vides récentes (la table ne grossit pas).
  for (const [t, quand] of Object.entries(memoire)) if (maintenant - Date.parse(quand) > 7 * 86_400_000) delete memoire[t];
  const { error } = await db()
    .from("import_decouverte")
    .update({
      verrou_jusqu: null,
      verrou_jeton: null,
      prochain_essai: new Date(prochain).toISOString(),
      dernier_essai: new Date(maintenant).toISOString(),
      dernier_resultat: resultat,
      essais_vides: vides,
      ajoutees_total: ((data?.ajoutees_total as number | undefined) ?? 0) + ajoutees,
      termes_vides: memoire,
    })
    .eq("family_id", familyId);
  if (error) enMemoire.set(familyId, { verrouJusqua: 0, prochain, essaisVides: vides, resultat });
}
