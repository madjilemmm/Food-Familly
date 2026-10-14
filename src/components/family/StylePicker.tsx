"use client";

import type { Style } from "@/lib/session";

const OPTIONS: { id: Style; title: string; text: string }[] = [
  { id: "simple", title: "Simple", text: "Gros boutons, l'essentiel" },
  { id: "fun", title: "Fun", text: "Swipe, matchs et recettes" },
];

/** Choix du style d'interface d'un membre. */
export function StylePicker({ value, onChange, name }: { value: Style; onChange?: (s: Style) => void; name?: string }) {
  return (
    <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Style de l'appli">
      {OPTIONS.map((o) => (
        <label
          key={o.id}
          className={`flex min-h-14 cursor-pointer flex-col justify-center rounded-bouton border-[3px] p-3 text-left has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-3 has-[:focus-visible]:outline-focus ${
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
          <span className="font-display text-bouton">{o.title}</span>
          <span className={`text-petit ${value === o.id ? "" : "text-encre-douce"}`}>{o.text}</span>
        </label>
      ))}
    </div>
  );
}
