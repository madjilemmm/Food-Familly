"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { jeNePartsPlus, jePars } from "@/app/actions/trips";
import { useErreurReseau } from "@/components/ErreurReseau";

/** Un lien d'action discret, de la taille d'un doigt : l'écran se recharge dès que c'est fait. */
function LienAction({ action, message, children }: { action: () => Promise<unknown>; message: string; children: React.ReactNode }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const { essayer, alerte } = useErreurReseau(message);
  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            if (await essayer(action)) router.refresh();
          })
        }
        className="inline-flex min-h-11 items-center font-semibold text-violet underline underline-offset-4 disabled:opacity-60"
      >
        {pending ? "…" : children}
      </button>
      {alerte}
    </>
  );
}

/** Celle ou celui qui a dit « Je pars » et ne part finalement pas : la liste redevient celle de tout le monde. */
export function JeNePartsPlus() {
  return (
    <LienAction action={() => jeNePartsPlus()} message="Pas de réseau : ton départ n'a pas été annulé. Réessaie quand ça revient.">
      Je ne pars plus
    </LienAction>
  );
}

/** Quelqu'un d'autre est parti : on peut prendre le relais (la famille en est prévenue, comme pour tout départ). */
export function PrendreLeRelais() {
  return (
    <LienAction action={() => jePars()} message="Pas de réseau : le relais n'a pas été pris. Réessaie quand ça revient.">
      Je prends le relais
    </LienAction>
  );
}
