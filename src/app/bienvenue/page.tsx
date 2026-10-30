import Link from "next/link";
import { Logo, Scene } from "@/design-system/components/Kaddie";
import { NoterEtape } from "@/components/NoterEtape";
import { ActionsAccueil } from "./ActionsAccueil";

export const metadata = { title: "Bienvenue — Kaddie" };

export default async function WelcomePage({ searchParams }: { searchParams: Promise<{ session?: string }> }) {
  // Renvoyé ici par un geste dont la session avait pris fin : on le dit, au lieu d'un faux « pas de réseau ».
  const { session } = await searchParams;
  return (
    <Scene
      as="main"
      duo="aubergine"
      seed={9}
      className="pb-safe flex min-h-dvh flex-col justify-between gap-8 px-6 pt-[max(env(safe-area-inset-top),1rem)]"
    >
      <div className="kd-monte mx-auto flex max-w-md flex-col items-center gap-5 pt-16 text-center">
        <Logo width={280} />
        <p className="max-w-xs text-[1.1875rem] leading-[1.6rem] font-medium text-balance">On mange quoi ce soir ? Décidez à plusieurs, Kaddie remplit le caddie.</p>
      </div>
      <div className="mx-auto w-full max-w-md pb-4">
        <NoterEtape etape="accueil" frequence="visite" />
        {session === "expiree" && (
          <p role="status" className="mb-4 rounded-pastille border-[3px] border-blanc px-4 py-3 text-center font-semibold">
            Ta session a pris fin. Reconnecte-toi avec le code de ta famille : rien n&apos;est perdu.
          </p>
        )}
        <ActionsAccueil />
        <Link href="/confidentialite" className="kd-petit mt-2 flex min-h-11 items-center justify-center text-blanc underline underline-offset-4">
          Confidentialité
        </Link>
      </div>
    </Scene>
  );
}
