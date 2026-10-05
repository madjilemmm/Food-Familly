import { NextResponse } from "next/server";
import { db } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Type d'une clé Supabase, sans jamais révéler sa valeur. */
function keyKind(key: string | undefined): string {
  if (!key) return "absente";
  const k = key.trim();
  if (k.startsWith("sb_secret_")) return "secret";
  if (k.startsWith("sb_publishable_")) return "publishable";
  try {
    const payload = JSON.parse(Buffer.from(k.split(".")[1], "base64url").toString());
    return `jwt:${payload.role ?? "?"}`;
  } catch {
    return "inconnue";
  }
}

/** Diagnostic de configuration (réservé aux appareils connectés). */
export async function GET() {
  const serverKey = keyKind(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const publicKey = keyKind(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  let database = "ok";
  try {
    const { error } = await db().from("profiles").select("id", { count: "exact", head: true });
    if (error) database = error.message;
  } catch (err) {
    database = err instanceof Error ? err.message : String(err);
  }
  return NextResponse.json({
    serverKey,
    publicKey,
    serverKeyOk: serverKey === "secret" || serverKey === "jwt:service_role",
    database,
  });
}
