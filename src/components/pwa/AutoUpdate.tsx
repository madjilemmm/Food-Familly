"use client";

import { useEffect } from "react";

const CHECK_EVERY_MS = 5 * 60 * 1000;
const LOADED_VERSION = process.env.NEXT_PUBLIC_BUILD_ID ?? "";

/**
 * Sur iPhone, l'appli installée reste en mémoire et garde l'ancienne version
 * même après une mise en ligne. On vérifie la version au retour dans l'appli
 * (et toutes les 5 min) et on recharge si elle a changé.
 * Jamais pendant la saisie d'une recette, pour ne rien faire perdre.
 */
export function AutoUpdate() {
  useEffect(() => {
    let checking = false;

    async function check() {
      if (checking || document.visibilityState !== "visible") return;
      if (location.pathname.startsWith("/recettes/")) return;
      checking = true;
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        if (!res.ok) return;
        const { version } = (await res.json()) as { version?: string };
        if (version && LOADED_VERSION && version !== LOADED_VERSION) {
          // Garde-fou : un seul rechargement par version, jamais de boucle.
          const key = "atable-reloaded-for";
          let already = false;
          try {
            already = sessionStorage.getItem(key) === version;
            sessionStorage.setItem(key, version);
          } catch {
            // stockage indisponible : on recharge quand même une fois
          }
          if (already) return;
          // Le service worker se met aussi à jour, puis on recharge la page.
          await navigator.serviceWorker?.getRegistration().then((r) => r?.update()).catch(() => {});
          location.reload();
        }
      } catch {
        // Hors connexion : on réessaiera plus tard.
      } finally {
        checking = false;
      }
    }

    check();
    document.addEventListener("visibilitychange", check);
    window.addEventListener("pageshow", check);
    const interval = setInterval(check, CHECK_EVERY_MS);
    return () => {
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("pageshow", check);
      clearInterval(interval);
    };
  }, []);

  return null;
}
