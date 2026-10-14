import Link from "next/link";
import { requireProfile, requireUser } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { getFamily, getProfiles } from "@/lib/data";
import { FamilyCode } from "@/components/family/FamilyCode";
import { MembersEditor } from "@/components/family/MembersEditor";
import { FamilyName } from "@/components/family/FamilyName";

export const metadata = { title: "Ma famille — À table !" };

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
    <main className="pt-safe pb-safe mx-auto max-w-xl px-5 pb-16 text-lg">
      {!welcome && (
        <Link href={ROUTES[me.style].home} className="inline-flex py-2 font-semibold text-tomato-600">
          ‹ Retour
        </Link>
      )}
      {welcome && (
        <div className="mt-4 mb-6 rounded-3xl bg-basil-100 p-5">
          <p className="text-2xl font-extrabold">🎉 Votre famille est créée !</p>
          <p className="mt-2">
            Envoyez le code ci-dessous aux autres membres. Sur leur téléphone, ils ouvrent l&apos;appli, touchent{" "}
            <strong>« J&apos;ai un code famille »</strong> et choisissent leur prénom.
          </p>
        </div>
      )}

      <FamilyName name={family.name} />
      <FamilyCode code={family.join_code} familyName={family.name} />

      <section className="mt-8">
        <h2 className="mb-3 text-2xl font-bold">Les membres</h2>
        <MembersEditor members={members} myId={me.id} />
      </section>

      {welcome && (
        <Link
          href={ROUTES[me.style].home}
          className="mt-8 block rounded-2xl bg-tomato-500 py-4 text-center text-xl font-bold text-white shadow-lg active:scale-[0.98]"
        >
          C&apos;est parti ! 🍽️
        </Link>
      )}
    </main>
  );
}
