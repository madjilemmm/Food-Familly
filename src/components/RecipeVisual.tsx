"use client";

/* eslint-disable @next/next/no-img-element -- photos Supabase, pas besoin de l'optimiseur */
import { useEffect, useRef, useState } from "react";

/**
 * Photo de la recette, ou à défaut le motif de fruits et légumes (comme la carte du kit).
 * Une photo qui ne charge pas (lien mort) laisse place au motif, jamais à l'icône d'image cassée.
 */
export function RecipeVisual({
  recipe,
  className = "",
}: {
  recipe: { id: string; title: string; photo_url: string | null };
  className?: string;
}) {
  const [cassee, setCassee] = useState(false);
  const ref = useRef<HTMLImageElement>(null);
  // Erreur arrivée avant que la page soit interactive : on la rattrape au montage.
  useEffect(() => {
    const img = ref.current;
    if (img?.complete && img.naturalWidth === 0) setCassee(true);
  }, []);
  if (recipe.photo_url && !cassee) {
    return (
      <img
        ref={ref}
        src={recipe.photo_url}
        alt=""
        loading="lazy"
        decoding="async"
        draggable={false}
        onError={() => setCassee(true)}
        className={`photo-absente object-cover ${className}`}
      />
    );
  }
  return <div aria-hidden className={`photo-absente ${className}`} />;
}
