import Link from "next/link";
import { headers } from "next/headers";
import QRCode from "qrcode";
import { requireProfile, requireUser } from "@/lib/auth";
import { getFamily, getProfiles } from "@/lib/data";
import { Scene } from "@/design-system/components/Kaddie";
import { FamilyCode } from "@/components/family/FamilyCode";
import { MembersEditor } from "@/components/family/MembersEditor";
import { FamilyName } from "@/components/family/FamilyName";
import { BandeauScene, IconeRetour } from "@/components/ui";
import { cheminInvitation, invitationAPartager } from "@/lib/acces";

export const metadata = { title: "La table — Kaddie" };

export default async function FamilyPage({ searchParams }: { searchParams: Promise<{ bienvenue?: string }> }) {
  const user = await requireUser();
  const [me, family, members, params] = await Promise.all([
    requireProfile(),
    getFamily(user.familyId),
    getProfiles(user.familyId),
    searchParams,
  ]);
  if (!family) return null;
  const welcome = params.bienvenue === "1";
  const invitation = await lienAPartager(user.familyId, me.id);

  return (
    <main className="ecran-famille mx-auto flex max-w-xl flex-col gap-6 px-5">
      {/* Le même bandeau que Ce soir, Idées et le caddie ; le rond y devient un retour. */}
      <BandeauScene
        compact
        fond="courses"
        illustration="courses"
        etiquette="Ta famille"
        titre="La table"
        reglages={false}
        actions={
          <Link href="/menu" aria-label="Retour" className="flex size-14 shrink-0 items-center justify-center rounded-full bg-blanc text-aubergine active:scale-95">
            <IconeRetour className="size-7" />
          </Link>
        }
      />
      {welcome ? (
        <Scene duo="aubergine" seed={14} format="carre" className="kd-monte mt-4 flex flex-col gap-3 rounded-carte p-6">
          <p className="kd-titre-2">Ta famille est créée.</p>
          <p>
            {invitation
              ? "Envoie le lien ci-dessous dans le groupe de la famille : chacun l'ouvre et choisit son prénom."
              : "Envoie le code ci-dessous aux autres. Sur leur téléphone, ils ouvrent Kaddie, tapent le code et choisissent leur prénom."}
          </p>
        </Scene>
      ) : null}

      <FamilyName name={family.name} />
      <FamilyCode code={family.join_code} familyName={family.name} invitation={invitation} />

      <section>
        <h2 className="kd-etiquette mb-1">Les membres</h2>
        <MembersEditor members={members} myId={me.id} />
      </section>

      <Link href="/reglages" className="kd-liste__article min-h-16 justify-between border-t-2 border-trait active:bg-trait/40">
        <span className="min-w-0">
          <span className="block font-semibold">Réglages</span>
          <span className="kd-petit block">Notifications, goûts, code de la famille, données</span>
        </span>
        <IconeRetour className="size-6 shrink-0 rotate-180 text-violet" />
      </Link>

      {welcome && (
        <Link href={"/"} className="kd-btn kd-btn--large">
          C&apos;est parti
        </Link>
      )}
    </main>
  );
}

/** Le lien d'invitation en cours (ou un nouveau), avec son QR code aux couleurs de Kaddie. */
async function lienAPartager(familyId: string, profileId: string) {
  const invitation = await invitationAPartager(familyId, profileId);
  if (!invitation) return null;
  const h = await headers();
  const hote = h.get("host") ?? "";
  const lien = `${h.get("x-forwarded-proto") ?? (hote.startsWith("localhost") ? "http" : "https")}://${hote}${cheminInvitation(invitation.jeton)}`;
  const qr = await QRCode.toString(lien, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#540472", light: "#ffffff" } });
  return { lien, expiresAt: invitation.expiresAt, qr };
}
