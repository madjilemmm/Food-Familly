import Link from "next/link";
import { Logo, Scene } from "@/design-system/components/Kaddie";
import { FamilyCodeForm } from "./FamilyCodeForm";
import { InstallFirst } from "./InstallFirst";

export const metadata = { title: "Bienvenue — Kaddie" };

export default function WelcomePage() {
  return (
    <Scene
      as="main"
      duo="aubergine"
      seed={9}
      className="pb-safe flex min-h-dvh flex-col justify-between gap-8 px-6 pt-[max(env(safe-area-inset-top),1rem)]"
    >
      <div className="kd-monte mx-auto flex max-w-md flex-col items-center gap-5 pt-16 text-center">
        <Logo width={280} />
        <p className="max-w-xs text-[1.1875rem] leading-[1.6rem] font-medium text-balance">On mange quoi ce soir ? Décidez à plusieurs, Kaddie remplit le caddie.</p>
      </div>
      <div className="mx-auto w-full max-w-md pb-4">
        <InstallFirst>
          <div className="kd-carte gap-4 p-6">
            <FamilyCodeForm />
          </div>
          <Link
            href="/bienvenue/creer"
            className="mt-3 flex min-h-14 items-center justify-center font-display text-bouton text-blanc underline underline-offset-4"
          >
            Créer ma famille
          </Link>
        </InstallFirst>
        <Link href="/confidentialite" className="kd-petit mt-2 flex min-h-11 items-center justify-center text-blanc underline underline-offset-4">
          Confidentialité
        </Link>
      </div>
    </Scene>
  );
}
