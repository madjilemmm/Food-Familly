"use client";

import { useState } from "react";
import { removeMember, saveMember } from "@/app/actions/auth";
import type { Profile } from "@/lib/data";
import { IconeCroix, IconePlus } from "@/components/ui";
import { MemberForm } from "./MemberForm";
import { ConfirmButton } from "@/components/courses/ConfirmButton";

export function MembersEditor({ members, myId }: { members: Profile[]; myId: string }) {
  const [editing, setEditing] = useState<string | null>(null);

  return (
    <>
      <ul className="kd-liste">
        {members.map((m) => (
          <li key={m.id} className="border-b-2 border-trait py-2">
            {editing === m.id ? (
              <MemberForm action={saveMember} member={m} onDone={() => setEditing(null)} />
            ) : (
              <div className="flex items-center gap-3">
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">
                    {m.name} {m.id === myId && <span className="text-petit font-normal text-encre-douce">(moi)</span>}
                  </span>
                  <span className="kd-petit">Style {m.style === "simple" ? "simple" : "fun"}</span>
                </span>
                <button onClick={() => setEditing(m.id)} className="min-h-14 px-2 font-semibold text-violet underline underline-offset-4">
                  Modifier
                </button>
                {m.id !== myId && (
                  <ConfirmButton
                    aria-label={`Retirer ${m.name}`}
                    action={() => removeMember(m.id)}
                    question={`Retirer ${m.name} de la famille ?`}
                    detail="Ses likes, ses goûts et ses demandes seront effacés."
                    confirmLabel={`Oui, retirer ${m.name}`}
                    className="flex size-14 shrink-0 items-center justify-center text-encre-douce"
                  >
                    <IconeCroix className="size-6" />
                  </ConfirmButton>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>

      {editing === "new" ? (
        <div className="mt-3 flex flex-col gap-2">
          <MemberForm action={saveMember} submitLabel="Ajouter" onDone={() => setEditing(null)} />
          <button onClick={() => setEditing(null)} className="min-h-14 w-full text-encre-douce underline underline-offset-4">
            Annuler
          </button>
        </div>
      ) : (
        <button
          onClick={() => setEditing("new")}
          className="mt-3 flex min-h-14 w-full items-center justify-center gap-2 rounded-bouton border-[3px] border-dashed border-encre-douce font-semibold text-encre-douce"
        >
          <IconePlus className="size-6" /> Ajouter un membre
        </button>
      )}
    </>
  );
}
