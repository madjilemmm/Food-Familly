"use client";

/* eslint-disable @next/next/no-img-element -- photos Supabase, pas besoin de l'optimiseur */
import { useEffect, useRef, useState } from "react";
import { photoALaTaille } from "@/lib/photos";

/** Une vignette de 56 px, nette sur un écran ×3. */
const VIGNETTE = 240;

/**
 * Photo de la recette, ou à défaut le motif de fruits et légumes (comme la carte du kit).
 * Une photo qui ne charge pas (lien mort) laisse place au motif, jamais à l'icône d'image cassée.
 * En vignette, la photo Marmiton est demandée à la bonne taille ; si cette version manque, l'originale.
 */
export function RecipeVisual({
  recipe,
  taille,
  className = "",
}: {
  recipe: { id: string; title: string; photo_url: string | null };
  taille?: "vignette";
  className?: string;
}) {
  const reduite = recipe.photo_url && taille === "vignette" ? photoALaTaille(recipe.photo_url, VIGNETTE) : recipe.photo_url;
  // 0 : la photo à la taille voulue, 1 : l'originale, 2 : le motif.
  const [essai, setEssai] = useState(0);
  const src = essai === 0 ? reduite : essai === 1 && reduite !== recipe.photo_url ? recipe.photo_url : null;
  const echec = () => setEssai((e) => (e === 0 && reduite !== recipe.photo_url ? 1 : 2));
  const ref = useRef<HTMLImageElement>(null);
  // Erreur arrivée avant que la page soit interactive : on la rattrape au montage.
  useEffect(() => {
    const img = ref.current;
    if (img?.complete && img.naturalWidth === 0) echec();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- une seule fois, au montage
  }, []);
  if (src) {
    return (
      <img
        ref={ref}
        src={src}
        alt=""
        loading="lazy"
        decoding="async"
        draggable={false}
        onError={echec}
        className={`photo-absente object-cover ${className}`}
      />
    );
  }
  return <div aria-hidden className={`photo-absente ${className}`} />;
}
