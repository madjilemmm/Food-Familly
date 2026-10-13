import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** La version actuellement en ligne (comparée à celle chargée sur le téléphone). */
export function GET() {
  return NextResponse.json(
    { version: process.env.NEXT_PUBLIC_BUILD_ID ?? "" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
