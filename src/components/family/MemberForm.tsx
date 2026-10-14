"use client";

import { useActionState, useEffect, useState } from "react";
import { SubmitButton } from "@/components/SubmitButton";
import { MessageErreur } from "@/components/ui";
import { StylePicker } from "./StylePicker";
import type { Style } from "@/lib/session";

type State = { error?: string; ok?: boolean };

/** Prénom et style d'un membre (création ou modification). L'emoji reste en base, sans être affiché. */
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
      <input type="hidden" name="emoji" value={member?.emoji ?? "😎"} />
      <input name="name" aria-label="Prénom" required maxLength={40} defaultValue={member?.name} placeholder="Prénom" className="kd-champ" />
      <div>
        <p className="kd-etiquette mb-2">Style de l&apos;appli</p>
        <StylePicker name="style" value={style} onChange={setStyle} />
      </div>
      {state.error && <MessageErreur>{state.error}</MessageErreur>}
      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  );
}
