import Link from "next/link";
import { Logo, Scene } from "@/design-system/components/Kaddie";
import { requireFamily } from "@/lib/auth";
import { getFamily, getProfiles } from "@/lib/data";
import { chooseProfile, leaveFamily } from "@/app/actions/auth";
import { IconeRetour, illustrationDe } from "@/components/ui";
import { QuitterFamille } from "@/components/pwa/QuitterFamille";

export const metadata = { title: "C'est qui ? — Kaddie" };
export const dynamic = "force-dynamic";

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ retire?: string }> }) {
  const [session, { retire }] = await Promise.all([requireFamily(), searchParams]);
  const [family, profiles] = await Promise.all([getFamily(session.familyId), getProfiles(session.familyId)]);
  // La famille a été supprimée (depuis un autre téléphone) : on repart de l'accueil.
  if (!family) {
    return (
      <main className="pt-safe pb-safe mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-5 px-5">
        <h1 className="kd-titre-1 text-aubergine">Cette famille n&apos;existe plus</h1>
        <p className="text-encre-douce">Elle a été supprimée, avec toutes ses données.</p>
        <form action={leaveFamily}>
          <button className="kd-btn kd-btn--large w-full">Revenir à l&apos;accueil</button>
        </form>
      </main>
    );
  }
  return (
    <main className="pt-safe pb-safe mx-auto flex min-h-dvh max-w-md flex-col gap-5 px-5">
      <div className="pt-6 text-violet">
        <Logo width={132} />
      </div>
      <div>
        <h1 className="kd-titre-1 text-aubergine">C&apos;est qui&nbsp;?</h1>
        <p className="mt-2 text-encre-douce">{family.name}</p>
      </div>
      {retire === "1" && (
        <p role="status" className="rounded-pastille border-[3px] border-aubergine bg-surface px-4 py-3 text-encre">
          Ton profil a été retiré de la famille. Choisis qui tu es dans la liste, ou ajoute-toi.
        </p>
      )}
      {/* Une liste, comme les recettes : une vignette de la scène, le prénom, un filet. */}
      <ul className="kd-liste border-t-2 border-trait">
        {profiles.map((p, i) => (
          <li key={p.id}>
            <form action={chooseProfile.bind(null, p.id)}>
              <button type="submit" className="flex w-full items-center gap-4 border-b-2 border-trait py-3 text-left active:bg-trait/40">
                <Scene duo="aubergine" illustration={illustrationDe(i)} format="carre" className="size-16 shrink-0 rounded-pastille" />
                <span className="kd-titre-2 min-w-0 flex-1 text-aubergine">{p.name}</span>
                <IconeRetour className="size-6 shrink-0 rotate-180 text-violet" />
              </button>
            </form>
          </li>
        ))}
      </ul>
      <Link href="/profil/nouveau" className="kd-btn kd-btn--secondaire kd-btn--large">
        Je ne suis pas dans la liste
      </Link>
      <p className="kd-petit mt-auto text-center">Ton choix reste sur ce téléphone.</p>
      <div className="text-center">
        <QuitterFamille
          question="Ce n'est pas ta famille ?"
          detail="Tu reviens à l'écran du code famille."
          confirmLabel="Oui, changer de famille"
          className="min-h-14 px-2 text-encre-douce underline underline-offset-4"
        >
          Ce n&apos;est pas ma famille
        </QuitterFamille>
      </div>
    </main>
  );
}
