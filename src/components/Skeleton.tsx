import { Logo, Scene } from "@/design-system/components/Kaddie";
import { FondCourses } from "@/components/ui";

/**
 * Écran de chargement affiché dès qu'on touche un onglet, le temps que les
 * données arrivent : le monogramme pulse doucement, pas de spinner générique.
 * « scene » pour les écrans à motif, « calme » pour les écrans sur fond lilas.
 */
export function Skeleton({ variant = "calme", seed = 3, fond }: { variant?: "scene" | "calme"; seed?: number; fond?: "courses" }) {
  const monogramme = (
    <div className="kd-pulse">
      <Logo variante="monogramme" width={72} title="" />
    </div>
  );
  return variant === "scene" ? (
    <Scene
      duo="aubergine"
      seed={seed}
      aria-busy="true"
      aria-label="Chargement"
      className="ecran-scene items-center justify-center"
    >
      {fond === "courses" && <FondCourses />}
      {monogramme}
    </Scene>
  ) : (
    <div aria-busy="true" aria-label="Chargement" className="h-screen-tabbar flex items-center justify-center text-violet">
      {monogramme}
    </div>
  );
}
