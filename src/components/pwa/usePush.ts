"use client";

import { useCallback, useEffect, useState } from "react";
import { isIOS, isStandalone, pushSupported } from "./device";

export type PushState =
  | "loading"
  | "install-first" // iPhone : l'appli doit d'abord être sur l'écran d'accueil
  | "unsupported"
  | "denied"
  | "off"
  | "on";

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function saveSubscription(sub: PushSubscription) {
  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(sub.toJSON()),
  });
  if (!res.ok) throw new Error("Enregistrement refusé");
}

export function usePush() {
  const [state, setState] = useState<PushState>("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!pushSupported()) {
        setState(isIOS() && !isStandalone() ? "install-first" : "unsupported");
        return;
      }
      if (Notification.permission === "denied") return setState("denied");
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub && Notification.permission === "granted") {
        // Re-synchronise (utile si on a changé de profil sur ce téléphone).
        saveSubscription(sub).catch(() => {});
        setState("on");
      } else {
        setState("off");
      }
    })().catch(() => setState("unsupported"));
  }, []);

  /** À appeler directement dans un onClick : iOS exige un geste de l'utilisateur. */
  const enable = useCallback(async () => {
    setError(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return;
      }
      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!key) throw new Error("Clé VAPID publique manquante");
      const reg = await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) }));
      await saveSubscription(sub);
      setState("on");
    } catch (err) {
      console.error(err);
      setError("L'activation n'a pas marché. Réessayez dans un instant.");
    }
  }, []);

  const disable = useCallback(async () => {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await fetch("/api/push/subscribe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      });
      await sub.unsubscribe();
    }
    setState("off");
  }, []);

  const test = useCallback(async () => {
    const res = await fetch("/api/push/test", { method: "POST" });
    const { sent } = (await res.json()) as { sent?: number };
    if (!sent) setError("Aucune notification envoyée : désactivez puis réactivez.");
  }, []);

  return { state, error, enable, disable, test };
}
