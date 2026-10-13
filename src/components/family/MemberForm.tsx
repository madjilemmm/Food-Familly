"use client";

import { useActionState, useEffect, useState } from "react";
import { SubmitButton } from "@/components/SubmitButton";
import { StylePicker } from "./StylePicker";
import type { Style } from "@/lib/session";

type State = { error?: string; ok?: boolean };

/** Prénom, emoji et style d'un membre (création ou modification). */
export function MemberForm({
  action,
  member,
  submitLabel = "Enregistrer",
  onDone,
}: {
  action: (prev: State, formData: FormData) => Promise<State>;
  member?: { id: string; name: string; emoji: string; style: Style };
  submitLabel?: string;
  onDone?: () => void;
}) {
  const [state, formAction] = useActionState(action, {});
  const [style, setStyle] = useState<Style>(member?.style ?? "fun");

  useEffect(() => {
    if (state.ok) onDone?.();
  }, [state, onDone]);

  return (
    <form action={formAction} className="space-y-4">
      {member && <input type="hidden" name="id" value={member.id} />}
      <div className="flex gap-2">
        <input
          name="emoji"
          aria-label="Emoji"
          defaultValue={member?.emoji ?? "😎"}
          maxLength={8}
          className="w-16 rounded-2xl border-2 border-stone-200 bg-white text-center text-2xl outline-none focus:border-tomato-500"
        />
        <input
          name="name"
          aria-label="Prénom"
          required
          maxLength={40}
          defaultValue={member?.name}
          placeholder="Prénom"
          className="min-w-0 flex-1 rounded-2xl border-2 border-stone-200 bg-white px-4 py-3 text-xl outline-none focus:border-tomato-500"
        />
      </div>
      <div>
        <p className="mb-2 font-semibold">Style de l&apos;appli</p>
        <StylePicker name="style" value={style} onChange={setStyle} />
      </div>
      {state.error && <p className="rounded-xl bg-tomato-50 px-4 py-3 text-tomato-700">{state.error}</p>}
      <SubmitButton className="w-full rounded-2xl bg-tomato-500 py-4 text-xl font-bold text-white active:scale-[0.98]">
        {submitLabel}
      </SubmitButton>
    </form>
  );
}
