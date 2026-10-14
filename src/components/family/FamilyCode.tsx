"use client";

import { useState, useTransition } from "react";
import { regenerateJoinCode } from "@/app/actions/auth";

/** Le code pour rejoindre la famille, à partager aux autres membres. */
export function FamilyCode({ code, familyName }: { code: string; familyName: string }) {
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  async function share() {
    const message = `Rejoins « ${familyName} » sur À table ! 🍽️\n${location.origin}\nCode famille : ${code}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "À table !", text: message });
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
    <section className="mt-5 rounded-3xl bg-white p-5 shadow-sm">
      <p className="text-stone-500">Code pour rejoindre la famille</p>
      <p className="mt-1 font-mono text-3xl font-bold tracking-wide break-all select-all">{code}</p>
      <button
        onClick={share}
        className="mt-4 w-full rounded-2xl bg-tomato-500 py-4 text-xl font-bold text-white active:scale-[0.98]"
      >
        {copied ? "✓ Copié !" : "📤 Partager le code"}
      </button>
      <button
        disabled={pending}
        onClick={() =>
          confirm("Changer le code ? L'ancien ne marchera plus pour rejoindre la famille (les téléphones déjà connectés le restent).") &&
          startTransition(() => regenerateJoinCode())
        }
        className="mt-3 min-h-11 w-full text-base text-stone-400 underline disabled:opacity-50"
      >
        Changer le code
      </button>
    </section>
  );
}
