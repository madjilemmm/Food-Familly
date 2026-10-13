"use client";

import { useState, useTransition } from "react";
import { renameFamily } from "@/app/actions/auth";

export function FamilyName({ name }: { name: string }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [pending, startTransition] = useTransition();

  if (!editing) {
    return (
      <div className="mt-2 flex items-center justify-between gap-3">
        <h1 className="text-3xl font-extrabold">{name}</h1>
        <button onClick={() => setEditing(true)} className="shrink-0 text-base text-stone-500 underline">
          Renommer
        </button>
      </div>
    );
  }
  return (
    <form
      className="mt-2 flex gap-2"
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
        className="min-w-0 flex-1 rounded-2xl border-2 border-stone-200 bg-white px-4 py-2 text-xl outline-none focus:border-tomato-500"
      />
      <button disabled={pending} className="rounded-2xl bg-stone-800 px-4 font-semibold text-white disabled:opacity-50">
        OK
      </button>
    </form>
  );
}
