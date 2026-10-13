import { NextResponse } from "next/server";
import { db } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * La version actuellement en ligne (comparée à celle chargée sur le téléphone)
 * et si la base a reçu la migration « familles ». Rien de privé.
 */
export async function GET() {
  const { error } = await db().from("families").select("id", { head: true, count: "exact" });
  return NextResponse.json(
    { version: process.env.NEXT_PUBLIC_BUILD_ID ?? "", database: error ? "à mettre à jour" : "à jour" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
