"use client";

import { useState, useTransition } from "react";
import { renameFamily } from "@/app/actions/auth";

export function FamilyName({ name }: { name: string }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [pending, startTransition] = useTransition();

  if (!editing) {
    return (
      <div className="flex items-center justify-between gap-3">
        <h1 className="kd-titre-2 min-w-0 text-aubergine">{name}</h1>
        <button onClick={() => setEditing(true)} className="min-h-14 shrink-0 px-1 text-encre-douce underline underline-offset-4">
          Renommer
        </button>
      </div>
    );
  }
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          await renameFamily(value);
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
  );
}
