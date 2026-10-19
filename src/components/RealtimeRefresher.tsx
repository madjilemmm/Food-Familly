"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { normalizeSupabaseUrl } from "@/lib/supabase/url";
import { APPAREIL_COOKIE } from "@/lib/appareil";

const EVENT = "refresh";
// Filet de sécurité, seulement quand le temps réel est coupé (chaque rafraîchissement vide le cache des onglets).
const FALLBACK_INTERVAL_MS = 120_000;
// Au retour dans l'appli : on ne recharge que si elle est restée cachée un moment.
const ABSENCE_MS = 30_000;

/** L'identifiant de ce téléphone, gardé en cookie pour que le serveur le joigne à ses signaux. */
function appareil(): string {
  const deja = document.cookie.match(new RegExp(`(?:^|; )${APPAREIL_COOKIE}=([^;]+)`))?.[1];
  if (deja) return deja;
  const id = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  document.cookie = `${APPAREIL_COOKIE}=${id}; path=/; max-age=31536000; samesite=lax`;
  return id;
}

/**
 * Recharge les données de la page dès qu'un autre membre de la famille change quelque
 * chose (signal Supabase Realtime, sans aucune donnée). Ses propres actions, elles, ont
 * déjà mis l'écran à jour : leur signal est ignoré. Recharge aussi au retour dans l'appli
 * après une absence, au retour du réseau, et toutes les 2 min si le temps réel est coupé.
 */
export function RealtimeRefresher({ familyId }: { familyId: string }) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const moi = appareil();
    const refresh = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        router.refresh();
        // Les onglets préchargés ont été vidés : on les reprépare.
        window.dispatchEvent(new Event("atable:refreshed"));
      }, 250);
    };

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ? normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL) : "";
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
    const supabase = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
    let connecte = false;
    const channel = supabase
      ?.channel(`famille-${familyId}`)
      .on("broadcast", { event: EVENT }, ({ payload }) => {
        if ((payload as { appareil?: string } | undefined)?.appareil !== moi) refresh();
      })
      .subscribe((status) => {
        connecte = status === "SUBSCRIBED";
      });

    let cacheeDepuis = 0;
    const onVisible = () => {
      if (document.visibilityState === "hidden") cacheeDepuis = Date.now();
      else if (cacheeDepuis && Date.now() - cacheeDepuis > ABSENCE_MS) refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", refresh);
    const interval = setInterval(() => !connecte && document.visibilityState === "visible" && refresh(), FALLBACK_INTERVAL_MS);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", refresh);
      clearInterval(interval);
      if (timer.current) clearTimeout(timer.current);
      if (channel) supabase?.removeChannel(channel);
    };
  }, [router, familyId]);

  return null;
}
