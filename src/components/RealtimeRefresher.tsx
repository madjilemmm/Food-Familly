"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { normalizeSupabaseUrl } from "@/lib/supabase/url";

const TOPIC = "famille";
const EVENT = "refresh";
const FALLBACK_INTERVAL_MS = 30_000;

/**
 * Recharge les données de la page dès qu'un autre membre de la famille
 * change quelque chose (signal Supabase Realtime, sans aucune donnée),
 * quand l'appli revient au premier plan, et toutes les 30 s par sécurité.
 */
export function RealtimeRefresher() {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const refresh = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => router.refresh(), 250);
    };

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ? normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL) : "";
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
    const supabase = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
    const channel = supabase?.channel(TOPIC).on("broadcast", { event: EVENT }, refresh).subscribe();

    const onVisible = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVisible);
    const interval = setInterval(() => document.visibilityState === "visible" && refresh(), FALLBACK_INTERVAL_MS);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(interval);
      if (timer.current) clearTimeout(timer.current);
      if (channel) supabase?.removeChannel(channel);
    };
  }, [router]);

  return null;
}
