import Link from "next/link";
import { Logo, Scene } from "@/design-system/components/Kaddie";
import { requireFamily } from "@/lib/auth";
import { getFamily, getProfiles } from "@/lib/data";
import { chooseProfile, leaveFamily } from "@/app/actions/auth";
import { illustrationDe } from "@/components/ui";

export const metadata = { title: "C'est qui ? — Kaddie" };
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const session = await requireFamily();
  const [family, profiles] = await Promise.all([getFamily(session.familyId), getProfiles(session.familyId)]);
  return (
    <main className="pt-safe pb-safe mx-auto flex min-h-dvh max-w-md flex-col gap-5 px-5">
      <div className="pt-6 text-violet">
        <Logo width={132} />
      </div>
      <div>
        <h1 className="kd-titre-1 text-aubergine">C&apos;est qui&nbsp;?</h1>
        {family && <p className="mt-2 text-encre-douce">{family.name}</p>}
      </div>
      <ul className="flex flex-col gap-4">
        {profiles.map((p, i) => (
          <li key={p.id}>
            <form action={chooseProfile.bind(null, p.id)}>
              <button type="submit" className="block w-full rounded-carte text-left active:scale-[0.98]">
                <Scene
                  duo="aubergine"
                  illustration={illustrationDe(i)}
                  format="paysage"
                  className="flex min-h-36 items-end rounded-carte p-5"
                >
                  <span className="kd-titre-2">{p.name}</span>
                </Scene>
              </button>
            </form>
          </li>
        ))}
      </ul>
      <Link href="/profil/nouveau" className="kd-btn kd-btn--secondaire kd-btn--large">
        Je ne suis pas dans la liste
      </Link>
      <p className="kd-petit mt-auto text-center">Ton choix reste sur ce téléphone.</p>
      <form action={leaveFamily} className="text-center">
        <button className="min-h-14 px-2 text-encre-douce underline underline-offset-4">Ce n&apos;est pas ma famille</button>
      </form>
    </main>
  );
}
