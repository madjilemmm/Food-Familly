/**
 * Pour qui est un plat des courses : les prénoms de celles et ceux qui le mangent
 * (« famille » si c'est tout le monde), et pour combien (invités compris).
 * Qui mange est décidé par le moteur (classerPlats, reco.ts) ou corrigé à la main.
 */
export type Convives = { noms: string[] | "famille"; n: number; corrige: boolean };

/** « Yoalem et toi », « Madji, Yoalem et Karin » (« Toi » en premier si on y est). */
export function listeDeNoms(noms: string[], moi?: string): string {
  const tri = moi && noms.includes(moi) ? [moi, ...noms.filter((n) => n !== moi)] : noms;
  const l = tri.map((n) => (n === moi ? "Toi" : n));
  return l.length > 1 ? `${l.slice(0, -1).join(", ")} et ${l[l.length - 1]}` : (l[0] ?? "");
}
