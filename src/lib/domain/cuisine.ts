/** « 25 min », « 1 h 30 », « 10 minutes » dans une étape : de quoi lancer un minuteur (en minutes). */
export function dureeDans(etape: string): number | null {
  const h = etape.match(/(\d+)\s*h(?:eures?)?\s*(\d{1,2})?\b/i);
  if (h) return Number(h[1]) * 60 + Number(h[2] ?? 0);
  const m = etape.match(/(\d+)\s*(?:min|minutes?|mn)\b/i);
  return m ? Number(m[1]) : null;
}
