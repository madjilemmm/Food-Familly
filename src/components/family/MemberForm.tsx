"use client";

import { useActionState, useEffect } from "react";
import { SubmitButton } from "@/components/SubmitButton";
import { MessageErreur } from "@/components/ui";
import type { Style } from "@/lib/session";

type State = { error?: string; ok?: boolean };

/** Le prénom d'un membre (création ou modification). L'emoji reste en base, sans être affiché. */
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

  useEffect(() => {
    if (state.ok) onDone?.();
  }, [state, onDone]);

  return (
    <form action={formAction} className="space-y-4">
      {member && <input type="hidden" name="id" value={member.id} />}
      <input type="hidden" name="emoji" value={member?.emoji ?? "😎"} />
      <input name="name" aria-label="Prénom" required maxLength={40} defaultValue={member?.name} placeholder="Prénom" className="kd-champ" />
      <input type="hidden" name="style" value={member?.style ?? "fun"} />
      {state.error && <MessageErreur>{state.error}</MessageErreur>}
      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  );
}
