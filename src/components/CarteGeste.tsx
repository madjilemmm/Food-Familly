"use client";

import { useEffect, useRef } from "react";
import { animate, motion, useMotionValue, useReducedMotion, useTransform, type PanInfo } from "motion/react";

/*
 * Une carte de pile à swiper (DESIGN.md §7) : elle suit le doigt, rotation =
 * déplacement / 20 plafonnée à 15°, tampons en fondu selon le déplacement.
 * Au-delà de 30 % de la largeur (25 % de la hauteur vers le haut) ou d'un
 * geste rapide, elle part en 240 ms ; sinon elle revient en rebondissant.
 * Sert au swipe des recettes et au questionnaire de goûts.
 */

export type Direction = "gauche" | "droite" | "haut";

const SEUIL = 0.3;
const SEUIL_HAUT = 0.25;
const VITESSE = 600;
const SORTIE = 0.24;
const SORTIE_COURBE = [0.22, 1, 0.36, 1] as const;
const REBOND = [0.34, 1.56, 0.64, 1] as const;

/** Les cartes du dessous, décalées et légèrement tournées. */
export const PILE = [
  { rotate: 0, y: 0, scale: 1 },
  { rotate: -2, y: 8, scale: 0.96 },
  { rotate: 5, y: 16, scale: 0.92 },
];

export function CarteGeste({
  rang,
  pileRef,
  onDecide,
  register,
  haut = false,
  tampons,
  children,
}: {
  rang: number;
  pileRef: React.RefObject<HTMLDivElement | null>;
  onDecide: (d: Direction) => void;
  /** La carte du dessus donne à la pile de quoi la faire partir (boutons, clavier). */
  register?: (fn: (d: Direction) => void) => void;
  /** Autorise le geste vers le haut. */
  haut?: boolean;
  tampons: Partial<Record<Direction, React.ReactNode>>;
  children: React.ReactNode;
}) {
  const calme = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const largeur = () => pileRef.current?.offsetWidth ?? 360;
  const hauteur = () => pileRef.current?.offsetHeight ?? 480;
  const rotateDrag = useTransform(x, (v) => (calme ? 0 : Math.max(-15, Math.min(15, v / 20))));
  const vers = {
    droite: useTransform(x, (v) => Math.min(1, Math.max(0, v / (largeur() * SEUIL)))),
    gauche: useTransform(x, (v) => Math.min(1, Math.max(0, -v / (largeur() * SEUIL)))),
    haut: useTransform(y, (v) => Math.min(1, Math.max(0, -v / (hauteur() * SEUIL_HAUT)))),
  };
  const isTop = rang === 0;
  const pos = PILE[Math.min(rang, PILE.length - 1)];

  const parti = useRef(false);
  const partir = (d: Direction) => {
    if (parti.current) return; // un double appui ne doit pas sauter une carte
    parti.current = true;
    if (calme) return onDecide(d);
    const fin = () => onDecide(d);
    if (d === "haut") animate(y, -hauteur() * 1.6, { duration: SORTIE, ease: SORTIE_COURBE }).then(fin);
    else animate(x, (d === "droite" ? 1 : -1) * largeur() * 1.6, { duration: SORTIE, ease: SORTIE_COURBE }).then(fin);
  };

  useEffect(() => {
    register?.(partir);
  });

  function onDragEnd(_: unknown, info: PanInfo) {
    const { offset, velocity } = info;
    const versLeHaut = haut && -offset.y > Math.abs(offset.x);
    if (versLeHaut && (-offset.y > hauteur() * SEUIL_HAUT || -velocity.y > VITESSE)) return partir("haut");
    const loin = Math.abs(offset.x) > largeur() * SEUIL;
    if (!versLeHaut && (loin || Math.abs(velocity.x) > VITESSE)) return partir((loin ? offset.x : velocity.x) > 0 ? "droite" : "gauche");
    animate(x, 0, { duration: 0.42, ease: REBOND });
    animate(y, 0, { duration: 0.42, ease: REBOND });
  }

  return (
    // Dehors : la place dans la pile. Dedans : la carte qui suit le doigt.
    <motion.div
      className="absolute inset-0"
      style={{ zIndex: PILE.length - rang }}
      initial={false}
      animate={{ y: pos.y, scale: pos.scale, rotate: calme ? 0 : pos.rotate }}
      exit={{ opacity: 0, transition: { duration: calme ? 0.12 : 0 } }}
      transition={{ duration: calme ? 0.12 : 0.24, ease: SORTIE_COURBE }}
    >
      <motion.div
        className="relative h-full touch-none select-none"
        style={{ x, y, rotate: rotateDrag }}
        drag={isTop ? (haut ? true : "x") : false}
        dragMomentum={false}
        onDragEnd={onDragEnd}
      >
        {children}
        {isTop &&
          (Object.keys(tampons) as Direction[]).map((d) => (
            <motion.span key={d} style={{ opacity: vers[d] }} aria-hidden className="pointer-events-none">
              {tampons[d]}
            </motion.span>
          ))}
      </motion.div>
    </motion.div>
  );
}
