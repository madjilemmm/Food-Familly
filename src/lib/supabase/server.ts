import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { serverEnv } from "@/lib/env";

let client: SupabaseClient | null = null;

/**
 * Client Supabase avec la clé secrète : à n'utiliser que côté serveur.
 * Toutes les lectures et écritures de l'appli passent par lui ; la base
 * n'est pas accessible avec la clé publique (RLS activée, aucune policy).
 */
export function db(): SupabaseClient {
  if (!client) {
    client = createClient(serverEnv.supabaseUrl, serverEnv.supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

export const REFRESH_TOPIC = "famille";
export const REFRESH_EVENT = "refresh";

/**
 * Prévient tous les écrans ouverts qu'ils doivent recharger leurs données.
 * Le message ne contient aucune donnée : juste un signal.
 */
export async function broadcastRefresh(): Promise<void> {
  try {
    const res = await fetch(`${serverEnv.supabaseUrl}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: {
        apikey: serverEnv.supabaseServiceKey,
        // Les anciennes clés "service_role" sont des JWT : on les passe aussi en Bearer.
        ...(serverEnv.supabaseServiceKey.startsWith("eyJ")
          ? { Authorization: `Bearer ${serverEnv.supabaseServiceKey}` }
          : {}),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [{ topic: REFRESH_TOPIC, event: REFRESH_EVENT, payload: {} }],
      }),
    });
    if (!res.ok) console.warn("Broadcast realtime refusé :", res.status);
  } catch (err) {
    console.warn("Broadcast realtime impossible :", err);
  }
}
