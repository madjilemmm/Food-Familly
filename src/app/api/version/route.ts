import { NextResponse } from "next/server";
import { db } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * La version actuellement en ligne (comparée à celle chargée sur le téléphone)
 * et si la base a reçu la migration « familles ». Rien de privé.
 */
export async function GET() {
  const t0 = Date.now();
  const { error } = await db().from("families").select("id", { head: true, count: "exact" });
  const dbMs = Date.now() - t0;
  const t1 = Date.now();
  await db().from("families").select("id", { head: true, count: "exact" });
  return NextResponse.json(
    {
      version: process.env.NEXT_PUBLIC_BUILD_ID ?? "",
      database: error ? "à mettre à jour" : "à jour",
      // Aller-retour serveur → base (1er appel, puis connexion déjà ouverte)
      dbMs: [dbMs, Date.now() - t1],
      region: process.env.VERCEL_REGION ?? "local",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
