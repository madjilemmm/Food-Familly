"use client";

import type { Style } from "@/lib/session";

const OPTIONS: { id: Style; title: string; text: string; icon: string }[] = [
  { id: "simple", title: "Simple", text: "Très gros boutons, l'essentiel", icon: "👆" },
  { id: "fun", title: "Fun", text: "Animé, swipe façon appli de rencontre", icon: "🔥" },
];

/** Choix du style d'interface d'un membre. */
export function StylePicker({ value, onChange, name }: { value: Style; onChange?: (s: Style) => void; name?: string }) {
  return (
    <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Style de l'appli">
      {OPTIONS.map((o) => (
        <label
          key={o.id}
          className={`cursor-pointer rounded-2xl border-2 p-3 text-left transition ${
            value === o.id ? "border-tomato-500 bg-tomato-50" : "border-stone-200 bg-white"
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
          <span className="block font-bold">
            {o.icon} {o.title}
          </span>
          <span className="text-sm text-stone-500">{o.text}</span>
        </label>
      ))}
    </div>
  );
}
