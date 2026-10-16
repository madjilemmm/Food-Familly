"use client";

import Link from "next/link";
import { IconeCloche } from "@/components/ui";
import { usePush } from "./usePush";
import { InstallHelp } from "./InstallHelp";

/**
 * - variant "banner" : n'apparaît que s'il reste quelque chose à faire
 *   (sur l'écran d'accueil de chacun) ;
 * - variant "pill" : une seule ligne, pour les écrans où la place compte (swipe) ;
 * - variant "icone" : un rond avec une cloche, dans un en-tête (ne pousse rien en apparaissant) ;
 * - variant "full" : toujours visible (dans les réglages).
 */
export function NotificationsCard({ variant }: { variant: "banner" | "pill" | "icone" | "full" }) {
  const { state, error, enable, disable, test } = usePush();

  // Pendant la vérification, la carte des réglages garde sa place (pas de saut de mise en page).
  if (state === "loading")
    return variant === "full" ? <section aria-busy="true" className="min-h-40" aria-label="Notifications" /> : null;
  if (variant !== "full" && (state === "on" || state === "unsupported" || state === "denied")) return null;

  if (variant === "icone") {
    const rond = "relative flex size-14 shrink-0 items-center justify-center rounded-full bg-blanc text-aubergine active:scale-95";
    const point = <span aria-hidden className="absolute top-2.5 right-2.5 size-3 rounded-full bg-accent outline-2 outline-blanc" />;
    return state === "install-first" ? (
      <Link href="/reglages" aria-label="Notifs : installe d'abord l'appli" className={rond}>
        <IconeCloche className="size-7" />
        {point}
      </Link>
    ) : (
      <button onClick={enable} aria-label="Activer les notifs" className={rond}>
        <IconeCloche className="size-7" />
        {point}
      </button>
    );
  }

  if (variant === "pill") {
    const pill = "flex min-h-14 w-full items-center gap-3 rounded-bouton bg-blanc px-4 text-left font-semibold text-aubergine active:scale-[0.98]";
    return state === "install-first" ? (
      <Link href="/reglages" className={pill}>
        <IconeCloche className="size-6 shrink-0" />
        <span className="flex-1">Notifs : installe d&apos;abord l&apos;appli</span>
      </Link>
    ) : (
      <button onClick={enable} className={pill}>
        <IconeCloche className="size-6 shrink-0" />
        <span className="flex-1">Activer les notifs</span>
        {error && <span className="kd-petit">Réessaie</span>}
      </button>
    );
  }

  return (
    // Dans les réglages : une section comme les autres, pas une carte de plus.
    <section className={variant === "full" ? "flex flex-col gap-3" : "kd-carte gap-3 p-5"}>
      <h2 className="kd-etiquette flex items-center gap-2">
        <IconeCloche className="size-5 text-violet" /> Notifications
      </h2>

      {state === "install-first" && (
        <>
          <p>Pour recevoir les notifs, ajoute d&apos;abord l&apos;appli sur l&apos;écran d&apos;accueil&nbsp;:</p>
          <InstallHelp />
        </>
      )}

      {state === "unsupported" && <p>Ce navigateur ne permet pas les notifs.</p>}

      {state === "denied" && (
        <p>
          Les notifs sont bloquées. Pour les autoriser&nbsp;: <strong>Réglages</strong> de l&apos;iPhone →{" "}
          <strong>Notifications</strong> → <strong>Kaddie</strong>
        </p>
      )}

      {state === "off" && (
        <>
          <p>Une alerte quand quelqu&apos;un part en courses ou qu&apos;un plat matche.</p>
          <button onClick={enable} className="kd-btn kd-btn--large">
            Activer les notifs
          </button>
        </>
      )}

      {state === "on" && (
        <>
          <p className="flex items-center gap-2 font-semibold">
            <span className="kd-pastille kd-pastille--match">Activées</span> sur ce téléphone
          </p>
          <div className="flex gap-3">
            <button onClick={test} className="kd-btn kd-btn--secondaire flex-1">
              Tester
            </button>
            <button onClick={disable} className="kd-btn kd-btn--secondaire flex-1">
              Couper
            </button>
          </div>
        </>
      )}

      {error && <p className="text-encre-douce">{error}</p>}
    </section>
  );
}
