"use client";

import { useState, useTransition } from "react";
import { renameFamily } from "@/app/actions/auth";
import { messageErreur } from "@/lib/reseau";
import { MessageErreur } from "@/components/ui";

export function FamilyName({ name }: { name: string }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [pending, startTransition] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);

  if (!editing) {
    return (
      <div className="flex items-center justify-between gap-3">
        <h2 className="kd-titre-2 min-w-0 text-aubergine">{name}</h2>
        <button onClick={() => setEditing(true)} className="min-h-14 shrink-0 px-1 text-encre-douce underline underline-offset-4">
          Renommer
        </button>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(async () => {
            setErreur(null);
            try {
              await renameFamily(value);
            } catch (err) {
              setErreur(messageErreur(err));
              return;
            }
            setEditing(false);
          });
        }}
      >
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          maxLength={60}
          aria-label="Nom de la famille"
          className="kd-champ min-w-0 flex-1"
        />
        <button disabled={pending} className="kd-btn shrink-0 px-5">
          OK
        </button>
      </form>
      {erreur && <MessageErreur>{erreur}</MessageErreur>}
    </div>
  );
}
