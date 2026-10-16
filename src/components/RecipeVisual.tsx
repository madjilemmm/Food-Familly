/* eslint-disable @next/next/no-img-element -- photos Supabase, pas besoin de l'optimiseur */

/** Photo de la recette, ou à défaut le motif de fruits et légumes (comme la carte du kit). */
export function RecipeVisual({
  recipe,
  className = "",
}: {
  recipe: { id: string; title: string; photo_url: string | null };
  className?: string;
}) {
  if (recipe.photo_url) {
    return <img src={recipe.photo_url} alt="" loading="lazy" decoding="async" draggable={false} className={`photo-absente object-cover ${className}`} />;
  }
  return <div aria-hidden className={`photo-absente ${className}`} />;
}
