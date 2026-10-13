import Link from "next/link";
import { requireFamily } from "@/lib/auth";
import { getFamily, getProfiles } from "@/lib/data";
import { chooseProfile, leaveFamily } from "@/app/actions/auth";

export const metadata = { title: "Qui es-tu ? — À table !" };
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const session = await requireFamily();
  const [family, profiles] = await Promise.all([getFamily(session.familyId), getProfiles(session.familyId)]);
  return (
    <main className="pt-safe pb-safe mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6">
      {family && <p className="text-center text-lg text-stone-500">{family.name}</p>}
      <h1 className="mb-8 text-center text-4xl font-extrabold">Qui es-tu ?</h1>
      <ul className="space-y-4">
        {profiles.map((p) => (
          <li key={p.id}>
            <form action={chooseProfile.bind(null, p.id)}>
              <button
                type="submit"
                className="flex w-full items-center gap-5 rounded-3xl bg-white px-6 py-5 text-left shadow-md active:scale-[0.98]"
              >
                <span className="text-5xl">{p.emoji}</span>
                <span className="text-3xl font-bold">{p.name}</span>
              </button>
            </form>
          </li>
        ))}
      </ul>
      <Link
        href="/profil/nouveau"
        className="mt-4 block rounded-3xl border-2 border-dashed border-stone-300 py-4 text-center text-lg font-semibold text-stone-600"
      >
        + Je ne suis pas dans la liste
      </Link>
      <p className="mt-8 text-center text-stone-500">Ton choix est retenu sur ce téléphone.</p>
      <form action={leaveFamily} className="mt-2 text-center">
        <button className="py-2 text-sm text-stone-400 underline">Ce n&apos;est pas ma famille</button>
      </form>
    </main>
  );
}
