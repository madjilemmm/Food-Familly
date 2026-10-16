"use client";

import { useActionState, useState } from "react";
import { createFamily } from "@/app/actions/auth";
import { SubmitButton } from "@/components/SubmitButton";
import { IconeCroix, IconePlus, MessageErreur } from "@/components/ui";
import type { Style } from "@/lib/session";

type Member = { key: number; name: string; emoji: string; style: Style };

// Un emoji reste enregistré pour chaque membre (champ en base), sans être affiché.
const EMOJIS = ["😎", "👩‍🍳", "👨‍🍳", "🤙", "🦄", "🐻", "🦊", "🐼", "🌸", "⚽", "🎮", "🎧", "👵", "👴", "🐱", "🌟"];
let nextKey = 1;

export function CreateFamilyForm() {
  const [state, action] = useActionState(createFamily, {});
  const [members, setMembers] = useState<Member[]>([{ key: nextKey++, name: "", emoji: "😎", style: "fun" }]);
  const [me, setMe] = useState(0);

  const update = (key: number, patch: Partial<Member>) =>
    setMembers((ms) => ms.map((m) => (m.key === key ? { ...m, ...patch } : m)));

  return (
    <form action={action} className="flex flex-col gap-6">
      <input
        type="hidden"
        name="members"
        value={JSON.stringify(members.map(({ name, emoji, style }) => ({ name, emoji, style })))}
      />
      <input type="hidden" name="me" value={me} />

      <label className="block">
        <span className="kd-etiquette mb-2 block">Nom de la famille</span>
        <input name="family_name" required maxLength={60} placeholder="Famille Martin" className="kd-champ" />
      </label>

      <fieldset className="min-w-0">
        <legend className="kd-etiquette mb-2">Les membres</legend>
        {/* Une ligne par membre : prénom, et qui je suis. */}
        <ul className="kd-liste border-t-2 border-trait">
          {members.map((m, i) => (
            <li key={m.key} className="flex flex-col gap-2 border-b-2 border-trait py-3">
              <div className="flex gap-2">
                <input
                  aria-label="Prénom"
                  value={m.name}
                  onChange={(e) => update(m.key, { name: e.target.value })}
                  placeholder="Prénom"
                  maxLength={40}
                  className="kd-champ min-w-0 flex-1"
                />
                {members.length > 1 && (
                  <button
                    type="button"
                    aria-label={`Retirer ${m.name || "ce membre"}`}
                    onClick={() => {
                      setMembers((ms) => ms.filter((x) => x.key !== m.key));
                      setMe((cur) => (cur === i ? 0 : cur > i ? cur - 1 : cur));
                    }}
                    className="flex size-14 shrink-0 items-center justify-center text-encre-douce"
                  >
                    <IconeCroix />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-pressed={me === i}
                  onClick={() => setMe(i)}
                  className={`min-h-12 shrink-0 rounded-bouton border-[3px] px-3 font-semibold ${
                    me === i ? "border-aubergine bg-accent text-on-accent" : "border-trait text-encre-douce"
                  }`}
                >
                  C&apos;est moi
                </button>
              </div>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => setMembers((ms) => [...ms, { key: nextKey++, name: "", emoji: EMOJIS[ms.length % EMOJIS.length], style: "fun" }])}
          className="mt-4 flex min-h-14 w-full items-center justify-center gap-2 rounded-bouton border-[3px] border-dashed border-encre-douce font-semibold text-encre-douce"
        >
          <IconePlus className="size-6" /> Ajouter un membre
        </button>
      </fieldset>

      {state.error && <MessageErreur>{state.error}</MessageErreur>}

      <SubmitButton pendingLabel="Création…">Créer ma famille</SubmitButton>
      <p className="kd-petit text-center">10 recettes classiques sont ajoutées pour démarrer.</p>
    </form>
  );
}
