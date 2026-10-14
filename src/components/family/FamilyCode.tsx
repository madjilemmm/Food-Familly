"use client";

import { useState, useTransition } from "react";
import { regenerateJoinCode } from "@/app/actions/auth";

/** Le code pour rejoindre la famille, à partager aux autres membres. */
export function FamilyCode({ code, familyName }: { code: string; familyName: string }) {
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  async function share() {
    const message = `Rejoins « ${familyName} » sur Kaddie\n${location.origin}\nCode famille : ${code}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Kaddie", text: message });
        return;
      }
    } catch {
      return; // partage annulé
    }
    await navigator.clipboard?.writeText(message).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <section className="kd-carte gap-3 p-5">
      <p className="kd-etiquette">Code pour rejoindre la famille</p>
      <p data-code className="font-display text-titre-2 tracking-[0.04em] break-all text-aubergine select-all">{code}</p>
      <button onClick={share} className="kd-btn kd-btn--large">
        {copied ? "Copié" : "Partager le code"}
      </button>
      <button
        disabled={pending}
        onClick={() =>
          confirm("Changer le code ? L'ancien ne marchera plus pour rejoindre la famille (les téléphones déjà connectés le restent).") &&
          startTransition(() => regenerateJoinCode())
        }
        className="min-h-14 w-full text-encre-douce underline underline-offset-4 disabled:opacity-50"
      >
        Changer le code
      </button>
    </section>
  );
}
