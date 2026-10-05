import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/supabase/server";

type SubscriptionBody = { endpoint?: string; keys?: { p256dh?: string; auth?: string } };

/** Enregistre l'abonnement push de cet appareil pour le profil connecté. */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.profileId) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as SubscriptionBody | null;
  const endpoint = body?.endpoint;
  const p256dh = body?.keys?.p256dh;
  const auth = body?.keys?.auth;
  if (!endpoint?.startsWith("https://") || !p256dh || !auth) {
    return NextResponse.json({ error: "Abonnement invalide" }, { status: 400 });
  }

  const { error } = await db()
    .from("push_subscriptions")
    .upsert(
      {
        profile_id: session.profileId,
        endpoint,
        p256dh,
        auth,
        user_agent: req.headers.get("user-agent")?.slice(0, 300) ?? null,
      },
      { onConflict: "endpoint" },
    );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/** Désactive les notifications sur cet appareil. */
export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session?.profileId) return NextResponse.json({ error: "Non connecté" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as SubscriptionBody | null;
  if (body?.endpoint) {
    await db().from("push_subscriptions").delete().eq("endpoint", body.endpoint).eq("profile_id", session.profileId);
  }
  return NextResponse.json({ ok: true });
}
