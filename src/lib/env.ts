import "server-only";
import { normalizeSupabaseUrl } from "@/lib/supabase/url";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variable d'environnement manquante : ${name} (voir .env.example)`);
  }
  return value;
}

export const serverEnv = {
  get supabaseUrl() {
    return normalizeSupabaseUrl(required("NEXT_PUBLIC_SUPABASE_URL"));
  },
  get supabaseServiceKey() {
    return required("SUPABASE_SERVICE_ROLE_KEY").trim();
  },
  get familyCode() {
    return required("FAMILY_CODE");
  },
  get vapidPublicKey() {
    return required("NEXT_PUBLIC_VAPID_PUBLIC_KEY");
  },
  get vapidPrivateKey() {
    return required("VAPID_PRIVATE_KEY");
  },
  get vapidSubject() {
    return process.env.VAPID_SUBJECT || "mailto:famille@example.com";
  },
};
