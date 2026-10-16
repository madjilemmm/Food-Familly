/**
 * Pour qui est un plat des courses, sans rien demander à personne :
 * - un match (la majorité en veut) → toute la famille ;
 * - un plat demandé → celles et ceux qui l'ont demandé (plus la personne
 *   qui fait les courses si c'est aussi son envie) ;
 * - une envie de la personne qui fait les courses → elle seule ;
 * - un plat ajouté autrement → toute la famille.
 * Le nombre se corrige à la main (−/+) sur le plat.
 */
export type Convives = { noms: string[] | "famille"; n: number; corrige: boolean };

export function convivesDe({
  isMatch,
  demandePar,
  envieDuShopper,
  shopper,
  famille,
  corrige,
}: {
  isMatch: boolean;
  demandePar: string[];
  envieDuShopper: boolean;
  shopper: string;
  famille: number;
  corrige?: number | null;
}): Convives {
  const base: Omit<Convives, "corrige"> = isMatch
    ? { noms: "famille", n: famille }
    : demandePar.length > 0 || envieDuShopper
      ? (() => {
          const noms = [...(envieDuShopper ? [shopper] : []), ...demandePar.filter((n) => n !== shopper)];
          return { noms, n: noms.length };
        })()
      : { noms: "famille", n: famille };
  return corrige ? { ...base, n: corrige, corrige: true } : { ...base, corrige: false };
}

/** « Toute la famille », « Toi », « Yoalem et Madji ». */
export function libelleConvives(c: Convives, moi: string): string {
  if (c.noms === "famille") return "Toute la famille";
  const noms = c.noms.map((n) => (n === moi ? "Toi" : n));
  return noms.length > 1 ? `${noms.slice(0, -1).join(", ")} et ${noms[noms.length - 1]}` : noms[0];
}
