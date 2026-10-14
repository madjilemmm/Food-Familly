"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { normalizeSupabaseUrl } from "@/lib/supabase/url";

const EVENT = "refresh";
// Filet de sécurité si le temps réel est coupé (chaque rafraîchissement vide le cache des onglets).
const FALLBACK_INTERVAL_MS = 120_000;

/**
 * Recharge les données de la page dès qu'un autre membre de la famille
 * change quelque chose (signal Supabase Realtime, sans aucune donnée),
 * quand l'appli revient au premier plan, et toutes les 2 min par sécurité.
 */
export function RealtimeRefresher({ familyId }: { familyId: string }) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
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
    const channel = supabase?.channel(`famille-${familyId}`).on("broadcast", { event: EVENT }, refresh).subscribe();

    const onVisible = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVisible);
    const interval = setInterval(() => document.visibilityState === "visible" && refresh(), FALLBACK_INTERVAL_MS);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(interval);
      if (timer.current) clearTimeout(timer.current);
      if (channel) supabase?.removeChannel(channel);
    };
  }, [router, familyId]);

  return null;
}
