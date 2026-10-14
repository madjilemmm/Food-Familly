"use client";

import { MotionConfig } from "motion/react";

/** Toutes les animations motion respectent « Réduire les animations » de l'iPhone. */
export function Mouvement({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
