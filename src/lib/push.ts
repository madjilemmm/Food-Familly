import "server-only";
import webpush from "web-push";
import { db } from "@/lib/supabase/server";
import { serverEnv } from "@/lib/env";

export type PushPayload = {
  title: string;
  body: string;
  /** Page à ouvrir au tap sur la notification. */
  url: string;
  /** Une notification avec le même tag remplace la précédente. */
  tag?: string;
};

let configured = false;
function configure() {
  if (configured) return;
  webpush.setVapidDetails(serverEnv.vapidSubject, serverEnv.vapidPublicKey, serverEnv.vapidPrivateKey);
  configured = true;
}

/**
 * Envoie une notification à tous les appareils des profils donnés.
 * Les abonnements expirés (désinstallation, permission retirée) sont
 * supprimés au passage.
 */
export async function sendPush(profileIds: string[], payload: PushPayload): Promise<number> {
  if (profileIds.length === 0) return 0;
  configure();

  const { data: subs, error } = await db()
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .in("profile_id", profileIds);
  if (error) throw new Error(error.message);

  const results = await Promise.allSettled(
    subs.map((s) =>
      webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(payload),
        { TTL: 6 * 60 * 60, urgency: "high" },
      ),
    ),
  );

  const expired: string[] = [];
  let sent = 0;
  results.forEach((r, i) => {
    if (r.status === "fulfilled") sent++;
    else {
      const status = (r.reason as { statusCode?: number })?.statusCode;
      if (status === 404 || status === 410) expired.push(subs[i].id);
      else console.warn("Échec d'envoi push :", status, (r.reason as Error)?.message);
    }
  });
  if (expired.length > 0) await db().from("push_subscriptions").delete().in("id", expired);
  return sent;
}
