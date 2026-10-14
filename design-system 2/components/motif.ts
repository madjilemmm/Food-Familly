// Kaddie — générateur du motif de blocs (la DA Frutz Up).
// Fonction pure : même graine = même motif, côté serveur comme côté client.

export type Duo = "aubergine" | "pistache";

/** aubergine : l'ambiance de l'appli. pistache : moments de fête et visuels de com. */
export const DUOS: Record<Duo, { fond: string; blocs: string; texte: string }> = {
  aubergine: { fond: "violet", blocs: "aubergine", texte: "blanc" },
  pistache: { fond: "pistache", blocs: "aubergine", texte: "blanc" },
};

type Pt = [number, number];

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const f = (v: number) => String(Math.round(v * 10) / 10);

function roundedPoly(pts: Pt[], r: number): string {
  const toward = (a: Pt, b: Pt, dist: number): Pt => {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const L = Math.hypot(dx, dy) || 1;
    const d = Math.min(dist, L / 2);
    return [a[0] + (dx * d) / L, a[1] + (dy * d) / L];
  };
  let out = "";
  pts.forEach((p1, i) => {
    const p0 = pts[(i - 1 + pts.length) % pts.length];
    const p2 = pts[(i + 1) % pts.length];
    const a = toward(p1, p0, r);
    const b = toward(p1, p2, r);
    out += `${i === 0 ? "M" : "L"}${f(a[0])} ${f(a[1])}Q${f(p1[0])} ${f(p1[1])} ${f(b[0])} ${f(b[1])}`;
  });
  return out + "Z";
}

export type MotifOptions = {
  /** largeur et hauteur du dessin (le SVG est ensuite étiré en mode « slice ») */
  width?: number;
  height?: number;
  /** graine : change-la pour un autre agencement */
  seed?: number;
  /** taille d'un bloc ; par défaut 38 % de √(largeur × hauteur) */
  unit?: number;
  /** autorise le grand rond en haut d'une colonne */
  rond?: boolean;
};

/** Renvoie le tracé SVG (attribut d) des blocs. */
export function motifPath({ width = 1000, height = 2000, seed = 7, unit, rond = true }: MotifOptions = {}): string {
  const rnd = mulberry32(seed);
  const uni = (a: number, b: number) => a + (b - a) * rnd();
  const U = unit ?? 0.38 * Math.sqrt(width * height);
  const gap = 0.15 * U;
  const rad = 0.17 * U;
  const j = 0.035 * U;
  const jj = () => uni(-j, j);
  let d = "";
  let x = -uni(0.25, 0.6) * U;
  let col = 0;
  let circleDone = !rond;
  while (x < width + gap) {
    const cw = uni(0.95, 1.3) * U;
    let y = -uni(0.2, 0.9) * U;
    const lean = uni(-0.03, 0.03) * U;
    let first = true;
    while (y < height + gap) {
      const rh = uni(0.9, 1.7) * U;
      if (first && !circleDone && col < 3 && rnd() < 0.6) {
        circleDone = true;
        const cr = cw / 2;
        const cx = x + cw / 2;
        const cy = y + rh - cr;
        d += `M${f(cx - cr)} ${f(cy)}a${f(cr)} ${f(cr)} 0 1 0 ${f(2 * cr)} 0a${f(cr)} ${f(cr)} 0 1 0 ${f(-2 * cr)} 0Z`;
      } else {
        const lxTop = x + lean * (y / height) + jj();
        const lxBot = x + lean * ((y + rh) / height) + jj();
        const pts: Pt[] = [
          [lxTop, y + jj()],
          [lxTop + cw + jj(), y + jj() + uni(-0.06, 0.06) * U],
          [lxBot + cw + jj(), y + rh + jj()],
          [lxBot, y + rh + jj()],
        ];
        d += roundedPoly(pts, rad);
      }
      first = false;
      y += rh + gap;
    }
    x += cw + gap;
    col += 1;
  }
  return d;
}
