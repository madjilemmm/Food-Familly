import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { sendDeadlineReminders } from "@/lib/notifications";

/*
 * Appelée chaque minute par Supabase (pg_cron, voir la migration
 * 20261016000002) : envoie les relances « plus que 10 minutes » dues.
 * Un appel en trop n'envoie que ce qui était déjà dû, une seule fois. Pour qu'on ne puisse pas non plus la solliciter
 * à vide, elle peut exiger un secret : si CRON_SECRET est défini (Vercel), l'appel doit porter « Authorization: Bearer <secret> »
 * (voir le README pour l'ajouter à la tâche pg_cron). Sans CRON_SECRET, elle reste ouverte comme avant.
 */
export const dynamic = "force-dynamic";

function autorise(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const recu = req.headers.get("authorization") ?? "";
  const attendu = `Bearer ${secret}`;
  return recu.length === attendu.length && timingSafeEqual(Buffer.from(recu), Buffer.from(attendu));
}

async function relancer(req: Request) {
  if (!autorise(req)) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const envoyees = await sendDeadlineReminders();
  return NextResponse.json({ envoyees });
}

export const GET = relancer;
export const POST = relancer;
