"use client";

import { leaveFamily } from "@/app/actions/auth";
import { ConfirmButton } from "@/components/courses/ConfirmButton";
import { desabonnerCetAppareil } from "./usePush";

/**
 * « Quitter cette famille sur ce téléphone » : les notifications de la famille s'arrêtent avec (sinon l'abonnement de ce
 * téléphone restait rattaché à un profil de la famille). Quitter n'est jamais bloqué par ce nettoyage.
 */
export function QuitterFamille({ question, detail, confirmLabel, className, children }: { question: string; detail?: string; confirmLabel: string; className?: string; children: React.ReactNode }) {
  return (
    <ConfirmButton
      action={async () => {
        await desabonnerCetAppareil();
        await leaveFamily();
      }}
      question={question}
      detail={detail}
      confirmLabel={confirmLabel}
      className={className}
    >
      {children}
    </ConfirmButton>
  );
}
