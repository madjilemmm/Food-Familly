"use client";

import { useState } from "react";
import { regenerateJoinCode } from "@/app/actions/auth";
import { ConfirmButton } from "@/components/courses/ConfirmButton";
import { IconePlus } from "@/components/ui";

const jusquau = (iso: string) =>
  new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Paris" }).format(new Date(iso));

/**
 * Inviter la famille : un lien à envoyer dans le groupe (valable 7 jours), son QR code
 * pour quelqu'un à côté de soi, et le code famille, qui marche toujours.
 */
export function FamilyCode({
  code,
  familyName,
  invitation,
}: {
  code: string;
  familyName: string;
  /** null : base pas encore prête pour les liens, on partage le code comme avant. */
  invitation: { lien: string; expiresAt: string; qr: string } | null;
}) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const texte = invitation ? `Rejoins « ${familyName} » sur Kaddie` : `Rejoins « ${familyName} » sur Kaddie\n${location.origin}\nCode famille : ${code}`;
    try {
      if (navigator.share) {
        await navigator.share(invitation ? { title: "Kaddie", text: texte, url: invitation.lien } : { title: "Kaddie", text: texte });
        return;
      }
    } catch {
      return; // partage annulé
    }
    await navigator.clipboard?.writeText(invitation ? `${texte} : ${invitation.lien}` : texte).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const codeAffiche = (
    // Coupé aux tirets si besoin (« cassoulet-1752- / galette »), jamais au milieu d'un mot.
    <p data-code className="font-display text-titre-2 tracking-[0.04em] break-words text-aubergine select-all">
      {code.split("-").map((part, i) => (
        <span key={i}>
          {i > 0 && "-"}
          {i > 0 && <wbr />}
          {part}
        </span>
      ))}
    </p>
  );

  return (
    <section className="flex flex-col gap-3">
      {invitation ? (
        <>
          <p className="kd-etiquette">Inviter ta famille</p>
          <p className="text-encre-douce">
            Envoie le lien dans le groupe de la famille : un appui, et chacun choisit son prénom. Valable jusqu&apos;à {jusquau(invitation.expiresAt)}.
          </p>
          <button onClick={share} className="kd-btn kd-btn--large">
            {copied ? "Lien copié" : "Partager le lien"}
          </button>
          <details className="group">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between font-semibold text-violet">
              QR code, pour quelqu&apos;un à côté de toi
              <IconePlus className="size-5 transition-transform group-open:rotate-45" />
            </summary>
            <div
              role="img"
              aria-label="QR code du lien d'invitation"
              className="mx-auto w-56 max-w-full rounded-carte bg-blanc p-3 [&_svg]:block [&_svg]:h-auto [&_svg]:w-full"
              dangerouslySetInnerHTML={{ __html: invitation.qr }}
            />
          </details>
          <p className="kd-etiquette mt-3">Ou le code famille</p>
          {codeAffiche}
        </>
      ) : (
        <>
          <p className="kd-etiquette">Code pour rejoindre la famille</p>
          {codeAffiche}
          <button onClick={share} className="kd-btn kd-btn--large">
            {copied ? "Copié" : "Partager le code"}
          </button>
        </>
      )}
      <ConfirmButton
        action={regenerateJoinCode}
        question="Changer le code ?"
        detail={`L'ancien ne marchera plus pour rejoindre la famille${invitation ? ", ni les liens déjà envoyés" : ""}. Les téléphones déjà connectés le restent.`}
        confirmLabel="Oui, changer le code"
        className="min-h-14 w-full text-encre-douce underline underline-offset-4"
      >
        Changer le code
      </ConfirmButton>
    </section>
  );
}
