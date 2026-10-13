"use client";

import { useActionState, useState } from "react";
import { createFamily } from "@/app/actions/auth";
import { SubmitButton } from "@/components/SubmitButton";
import { StylePicker } from "@/components/family/StylePicker";
import type { Style } from "@/lib/session";

type Member = { key: number; name: string; emoji: string; style: Style };

const EMOJIS = ["😎", "👩‍🍳", "👨‍🍳", "🤙", "🦄", "🐻", "🦊", "🐼", "🌸", "⚽", "🎮", "🎧", "👵", "👴", "🐱", "🌟"];
let nextKey = 1;

export function CreateFamilyForm() {
  const [state, action] = useActionState(createFamily, {});
  const [members, setMembers] = useState<Member[]>([{ key: nextKey++, name: "", emoji: "😎", style: "fun" }]);
  const [me, setMe] = useState(0);

  const update = (key: number, patch: Partial<Member>) =>
    setMembers((ms) => ms.map((m) => (m.key === key ? { ...m, ...patch } : m)));

  return (
    <form action={action} className="space-y-6">
      <input
        type="hidden"
        name="members"
        value={JSON.stringify(members.map(({ name, emoji, style }) => ({ name, emoji, style })))}
      />
      <input type="hidden" name="me" value={me} />

      <label className="block">
        <span className="mb-1 block font-semibold">Nom de la famille</span>
        <input
          name="family_name"
          required
          maxLength={60}
          placeholder="Ex : Famille Martin"
          className="w-full rounded-2xl border-2 border-stone-200 bg-white px-4 py-3 text-xl outline-none focus:border-tomato-500"
        />
      </label>

      <fieldset className="min-w-0">
        <legend className="mb-2 font-semibold">Les membres</legend>
        <ul className="space-y-4">
          {members.map((m, i) => (
            <li key={m.key} className={`rounded-3xl bg-white p-4 shadow-sm ring-4 ${me === i ? "ring-tomato-500" : "ring-transparent"}`}>
              <div className="flex gap-2">
                <select
                  aria-label="Emoji"
                  value={m.emoji}
                  onChange={(e) => update(m.key, { emoji: e.target.value })}
                  className="w-16 rounded-xl border-2 border-stone-200 bg-white text-center text-2xl"
                >
                  {EMOJIS.map((e) => (
                    <option key={e}>{e}</option>
                  ))}
                </select>
                <input
                  aria-label="Prénom"
                  value={m.name}
                  onChange={(e) => update(m.key, { name: e.target.value })}
                  placeholder="Prénom"
                  maxLength={40}
                  className="min-w-0 flex-1 rounded-xl border-2 border-stone-200 px-3 py-2 text-lg outline-none focus:border-tomato-500"
                />
                {members.length > 1 && (
                  <button
                    type="button"
                    aria-label={`Retirer ${m.name || "ce membre"}`}
                    onClick={() => {
                      setMembers((ms) => ms.filter((x) => x.key !== m.key));
                      setMe((cur) => (cur === i ? 0 : cur > i ? cur - 1 : cur));
                    }}
                    className="px-2 text-xl text-stone-400"
                  >
                    ✕
                  </button>
                )}
              </div>
              <div className="mt-3">
                <StylePicker value={m.style} onChange={(style) => update(m.key, { style })} />
              </div>
              <button
                type="button"
                onClick={() => setMe(i)}
                className={`mt-3 w-full rounded-xl py-2 font-semibold ${me === i ? "bg-tomato-500 text-white" : "bg-stone-100 text-stone-600"}`}
              >
                {me === i ? "✓ C'est moi" : "C'est moi"}
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => setMembers((ms) => [...ms, { key: nextKey++, name: "", emoji: EMOJIS[ms.length % EMOJIS.length], style: "fun" }])}
          className="mt-3 w-full rounded-2xl border-2 border-dashed border-stone-300 py-3 font-semibold text-stone-600"
        >
          + Ajouter un membre
        </button>
      </fieldset>

      {state.error && <p className="rounded-xl bg-tomato-50 px-4 py-3 text-tomato-700">{state.error}</p>}

      <SubmitButton
        pendingLabel="Création…"
        className="w-full rounded-2xl bg-tomato-500 py-4 text-xl font-bold text-white shadow-lg active:scale-[0.98]"
      >
        Créer ma famille
      </SubmitButton>
      <p className="text-center text-sm text-stone-500">10 recettes françaises classiques sont ajoutées pour démarrer.</p>
    </form>
  );
}
