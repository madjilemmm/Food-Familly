"use client";

import { useOptimistic, useTransition } from "react";
import Link from "next/link";
import { addItems } from "@/app/actions/list";
import { useErreurReseau } from "@/components/ErreurReseau";
import { IconePlus } from "@/components/ui";

const pastille = "flex min-h-11 items-center gap-1.5 rounded-bouton border-[3px] border-aubergine bg-surface px-4 font-semibold text-aubergine active:scale-95";

/**
 * Quelqu'un est parti faire les courses : une dernière demande, d'un appui (« Du pain »),
 * arrive sur sa liste. Les choix viennent des achats habituels ; « Autre chose » ouvre le caddie.
 */
export function DerniereDemande({ qui, choix, versCaddie = true }: { qui: string; choix: string[]; versCaddie?: boolean }) {
  const [, startTransition] = useTransition();
  const [ajoutes, ajouter] = useOptimistic<string[], string>([], (s, nom) => [...s, nom]);
  const { essayer, alerte } = useErreurReseau();
  const demander = (nom: string) =>
    startTransition(async () => {
      ajouter(nom);
      await essayer(() => addItems([nom], "request"));
    });
  const restes = choix.filter((c) => !ajoutes.includes(c));
  return (
    <section aria-label="Dernière demande" className="kd-carte mb-8 gap-3 p-4">
      <p className="font-semibold">{qui} part faire les courses. Une dernière demande ?</p>
      {ajoutes.length > 0 && <p role="status" className="kd-petit font-semibold">Ajouté à sa liste : {ajoutes.join(", ")}.</p>}
      <div className="flex flex-wrap gap-2">
        {restes.map((nom) => (
          <button key={nom} type="button" aria-label={`Demander ${nom}`} onClick={() => demander(nom)} className={pastille}>
            <IconePlus className="size-4 text-violet" />
            {nom}
          </button>
        ))}
        {versCaddie && (
          <Link href="/courses" className="flex min-h-11 items-center px-2 font-semibold text-violet underline underline-offset-4">
            Autre chose
          </Link>
        )}
      </div>
      {alerte}
    </section>
  );
}
