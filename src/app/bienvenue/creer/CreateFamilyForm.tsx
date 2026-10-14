"use client";

import { useActionState, useState } from "react";
import { createFamily } from "@/app/actions/auth";
import { SubmitButton } from "@/components/SubmitButton";
import { StylePicker } from "@/components/family/StylePicker";
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
        <ul className="flex flex-col gap-4">
          {members.map((m, i) => (
            <li
              key={m.key}
              className={`flex flex-col gap-3 rounded-carte bg-surface p-4 outline-4 ${me === i ? "outline-accent" : "outline-transparent"}`}
            >
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
              <StylePicker value={m.style} onChange={(style) => update(m.key, { style })} />
              <button
                type="button"
                aria-pressed={me === i}
                onClick={() => setMe(i)}
                className={`kd-btn kd-btn--large ${me === i ? "kd-btn--like" : "kd-btn--secondaire"}`}
              >
                C&apos;est moi
              </button>
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
