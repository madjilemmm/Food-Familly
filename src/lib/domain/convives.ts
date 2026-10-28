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

/** « Tu en as envie », « Karin et toi en avez envie », « Karin en a envie », « Karin et Léo en ont envie ». */
export function phraseEnvie(noms: string[], moi: string): string {
  if (noms.length === 0) return "";
  const autres = noms.filter((n) => n !== moi);
  if (noms.includes(moi)) return autres.length === 0 ? "Tu en as envie" : `${autres.join(", ")} et toi en avez envie`;
  return autres.length === 1 ? `${autres[0]} en a envie` : `${listeDeNoms(autres)} en ont envie`;
}
