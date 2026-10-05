import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { sendPush } from "@/lib/push";

/** Envoie une notification de test à soi-même. */
export async function POST() {
  const session = await getSession();
  if (!session?.profileId) return NextResponse.json({ error: "Non connecté" }, { status: 401 });
  const sent = await sendPush([session.profileId], {
    title: "Ça marche ! 🎉",
    body: "Les notifications sont bien activées sur ce téléphone.",
    url: "/",
    tag: "test",
  });
  return NextResponse.json({ sent });
}
