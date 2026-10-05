/* eslint-disable @next/next/no-img-element -- photos Supabase, pas besoin de l'optimiseur */

const GRADIENTS = [
  "from-orange-300 to-rose-400",
  "from-amber-200 to-orange-400",
  "from-lime-200 to-emerald-400",
  "from-sky-200 to-indigo-400",
  "from-pink-200 to-fuchsia-400",
  "from-yellow-200 to-amber-400",
  "from-teal-200 to-cyan-500",
  "from-red-300 to-orange-500",
];

function gradientFor(id: string) {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return GRADIENTS[h % GRADIENTS.length];
}

/** Photo de la recette, ou à défaut un joli dégradé avec son emoji. */
export function RecipeVisual({
  recipe,
  className = "",
  emojiClassName = "text-5xl",
}: {
  recipe: { id: string; title: string; emoji: string; photo_url: string | null };
  className?: string;
  emojiClassName?: string;
}) {
  if (recipe.photo_url) {
    return (
      <img
        src={recipe.photo_url}
        alt={recipe.title}
        draggable={false}
        className={`object-cover ${className}`}
      />
    );
  }
  return (
    <div
      aria-hidden
      className={`flex items-center justify-center bg-gradient-to-br ${gradientFor(recipe.id)} ${className}`}
    >
      <span className={`drop-shadow-sm select-none ${emojiClassName}`}>{recipe.emoji}</span>
    </div>
  );
}
