import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getFamily } from "@/lib/data";
import { cheminInvitation, invitationAPartager } from "@/lib/acces";
import { noterEtape } from "@/lib/etapes";
import { memeSite, origineDuSite } from "@/lib/origine";

export const dynamic = "force-dynamic";

/**
 * Le lien à envoyer à la famille (celui en cours, ou un nouveau) : « Prévenir la famille » l'appelle au moment d'envoyer.
 * Base pas encore prête pour les liens : on renvoie le code famille, qui marche toujours.
 */
export async function POST(req: Request) {
  if (!memeSite(req)) return NextResponse.json({ erreur: "origine" }, { status: 403 });
  const user = await requireUser();
  const [invitation, famille] = await Promise.all([invitationAPartager(user.familyId, user.profileId), getFamily(user.familyId)]);
  const origine = origineDuSite(await headers());
  await noterEtape("invitation_envoyee");
  return NextResponse.json({ lien: invitation ? `${origine}${cheminInvitation(invitation.jeton)}` : null, code: famille?.join_code ?? null, origine });
}
