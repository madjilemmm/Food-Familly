"use client";

import type { Style } from "@/lib/session";

const OPTIONS: { id: Style; title: string; text: string }[] = [
  { id: "simple", title: "Simple", text: "Gros boutons, l'essentiel" },
  { id: "fun", title: "Fun", text: "Swipe, matchs et recettes" },
];

/** Choix du style d'interface d'un membre. */
export function StylePicker({
  value,
  onChange,
  name,
  compact = false,
}: {
  value: Style;
  onChange?: (s: Style) => void;
  name?: string;
  /** Deux petites puces sans description (dans une liste de membres). */
  compact?: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Style de l'appli">
      {OPTIONS.map((o) => (
        <label
          key={o.id}
          className={`flex cursor-pointer flex-col justify-center rounded-bouton border-[3px] text-left ${compact ? "min-h-12 px-3" : "min-h-14 p-3"} has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-3 has-[:focus-visible]:outline-focus ${
            value === o.id ? "border-aubergine bg-accent text-on-accent" : "border-trait bg-surface"
          }`}
        >
          <input
            type="radio"
            name={name}
            value={o.id}
            checked={value === o.id}
            onChange={() => onChange?.(o.id)}
            className="sr-only"
          />
          <span className={compact ? "font-semibold" : "font-display text-bouton"}>{o.title}</span>
          {!compact && <span className={`text-petit ${value === o.id ? "" : "text-encre-douce"}`}>{o.text}</span>}
        </label>
      ))}
    </div>
  );
}
