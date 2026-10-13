"use client";

import { useState, useTransition } from "react";
import { removeMember, saveMember } from "@/app/actions/auth";
import type { Profile } from "@/lib/data";
import { MemberForm } from "./MemberForm";

export function MembersEditor({ members, myId }: { members: Profile[]; myId: string }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <ul className="space-y-3">
        {members.map((m) => (
          <li key={m.id} className="rounded-3xl bg-white p-4 shadow-sm">
            {editing === m.id ? (
              <MemberForm action={saveMember} member={m} onDone={() => setEditing(null)} />
            ) : (
              <div className="flex items-center gap-3">
                <span className="text-4xl">{m.emoji}</span>
                <span className="flex-1">
                  <span className="block text-xl font-bold">
                    {m.name} {m.id === myId && <span className="text-base font-normal text-stone-400">(moi)</span>}
                  </span>
                  <span className="text-base text-stone-500">Style {m.style === "simple" ? "simple 👆" : "fun 🔥"}</span>
                </span>
                <button onClick={() => setEditing(m.id)} className="rounded-xl bg-stone-100 px-3 py-2 text-base font-semibold">
                  Modifier
                </button>
                {m.id !== myId && (
                  <button
                    disabled={pending}
                    aria-label={`Retirer ${m.name}`}
                    onClick={() =>
                      confirm(`Retirer ${m.name} de la famille ? Ses likes et ses demandes seront effacés.`) &&
                      startTransition(() => removeMember(m.id))
                    }
                    className="px-2 text-xl text-stone-300"
                  >
                    ✕
                  </button>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>

      {editing === "new" ? (
        <div className="mt-3 rounded-3xl bg-white p-4 shadow-sm">
          <MemberForm action={saveMember} submitLabel="Ajouter" onDone={() => setEditing(null)} />
          <button onClick={() => setEditing(null)} className="mt-2 w-full py-2 text-stone-500 underline">
            Annuler
          </button>
        </div>
      ) : (
        <button
          onClick={() => setEditing("new")}
          className="mt-3 w-full rounded-2xl border-2 border-dashed border-stone-300 py-3 font-semibold text-stone-600"
        >
          + Ajouter un membre
        </button>
      )}
    </>
  );
}
