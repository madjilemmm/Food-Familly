"use client";

import { usePush } from "./usePush";
import { InstallHelp } from "./InstallHelp";

/**
 * - variant "banner" : n'apparaît que s'il reste quelque chose à faire
 *   (sur l'écran d'accueil de chacun) ;
 * - variant "full" : toujours visible (dans les réglages).
 */
export function NotificationsCard({ variant }: { variant: "banner" | "full" }) {
  const { state, error, enable, disable, test } = usePush();

  if (state === "loading") return null;
  if (variant === "banner" && (state === "on" || state === "unsupported" || state === "denied")) return null;

  return (
    <section className={`rounded-3xl p-5 ${variant === "banner" ? "mb-5 bg-amber-100" : "mb-6 bg-white"}`}>
      <h2 className="mb-2 flex items-center gap-2 text-xl font-bold">
        <span className="text-2xl">🔔</span> Notifications
      </h2>

      {state === "install-first" && (
        <>
          <p className="mb-3">Pour recevoir les notifications, ajoutez d&apos;abord l&apos;appli sur l&apos;écran d&apos;accueil :</p>
          <InstallHelp />
        </>
      )}

      {state === "unsupported" && <p>Ce navigateur ne permet pas les notifications.</p>}

      {state === "denied" && (
        <p>
          Les notifications sont bloquées. Pour les autoriser : <strong>Réglages</strong> de l&apos;iPhone →{" "}
          <strong>Notifications</strong> → <strong>À table !</strong>
        </p>
      )}

      {state === "off" && (
        <>
          <p className="mb-3">Pour être prévenu au bon moment, sans rien surveiller.</p>
          <button
            onClick={enable}
            className="w-full rounded-2xl bg-amber-500 py-4 text-xl font-bold text-white shadow active:scale-[0.98]"
          >
            Activer les notifications
          </button>
        </>
      )}

      {state === "on" && (
        <>
          <p className="mb-3 font-semibold text-basil-600">✓ Activées sur ce téléphone</p>
          <div className="flex gap-3">
            <button onClick={test} className="flex-1 rounded-2xl bg-stone-100 py-3 font-semibold active:scale-[0.98]">
              Tester
            </button>
            <button onClick={disable} className="flex-1 rounded-2xl bg-stone-100 py-3 font-semibold text-stone-500 active:scale-[0.98]">
              Désactiver
            </button>
          </div>
        </>
      )}

      {error && <p className="mt-3 text-tomato-700">{error}</p>}
    </section>
  );
}
