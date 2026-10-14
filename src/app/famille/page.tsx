import Link from "next/link";
import { requireProfile, requireUser } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { getFamily, getProfiles } from "@/lib/data";
import { Scene } from "@/design-system/components/Kaddie";
import { FamilyCode } from "@/components/family/FamilyCode";
import { MembersEditor } from "@/components/family/MembersEditor";
import { FamilyName } from "@/components/family/FamilyName";
import { IconeRetour } from "@/components/ui";

export const metadata = { title: "Ma famille — Kaddie" };

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

  return (
    <main className="pt-safe pb-safe mx-auto flex max-w-xl flex-col gap-6 px-5 pb-16">
      {welcome ? (
        <Scene duo="aubergine" seed={14} format="carre" className="kd-monte mt-4 flex flex-col gap-3 rounded-carte p-6">
          <p className="kd-titre-2">Ta famille est créée.</p>
          <p>
            Envoie le code ci-dessous aux autres. Sur leur téléphone, ils ouvrent Kaddie, tapent le code et choisissent leur prénom.
          </p>
        </Scene>
      ) : (
        <Link href={ROUTES[me.style].home} className="-ml-2 inline-flex min-h-14 items-center gap-1 self-start font-semibold text-violet">
          <IconeRetour className="size-6" /> Retour
        </Link>
      )}

      <FamilyName name={family.name} />
      <FamilyCode code={family.join_code} familyName={family.name} />

      <section>
        <h2 className="kd-titre-2 mb-3 text-aubergine">Les membres</h2>
        <MembersEditor members={members} myId={me.id} />
      </section>

      {welcome && (
        <Link href={ROUTES[me.style].home} className="kd-btn kd-btn--large">
          C&apos;est parti
        </Link>
      )}
    </main>
  );
}
