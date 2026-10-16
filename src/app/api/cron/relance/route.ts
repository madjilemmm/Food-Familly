import { NextResponse } from "next/server";
import { sendDeadlineReminders } from "@/lib/notifications";

/*
 * Appelée chaque minute par Supabase (pg_cron, voir la migration
 * 20261016000002) : envoie les relances « plus que 10 minutes » dues.
 * Rien de secret : un appel en trop n'envoie que ce qui était déjà dû, une seule fois.
 */
export const dynamic = "force-dynamic";

async function relancer() {
  const envoyees = await sendDeadlineReminders();
  return NextResponse.json({ envoyees });
}

export const GET = relancer;
export const POST = relancer;
