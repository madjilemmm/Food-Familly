import Link from "next/link";
import { requireProfile, requireUser } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { getFamily } from "@/lib/data";
import { forgetProfile, leaveFamily } from "@/app/actions/auth";
import { NotificationsCard } from "@/components/pwa/NotificationsCard";
import { MyStyle } from "@/components/family/MyStyle";
import { IconeRetour } from "@/components/ui";

export const metadata = { title: "Réglages — Kaddie" };

export default async function SettingsPage() {
  const user = await requireUser();
  const [me, family] = await Promise.all([requireProfile(), getFamily(user.familyId)]);
  const lien = "kd-carte flex-row min-h-16 items-center justify-between px-5 font-display text-bouton text-aubergine active:scale-[0.99]";
  return (
    <main className="pt-safe pb-safe mx-auto flex max-w-xl flex-col gap-6 px-5 pb-16">
      <div>
        <Link href={ROUTES[me.style].home} className="-ml-2 inline-flex min-h-14 items-center gap-1 font-semibold text-violet">
          <IconeRetour className="size-6" /> Retour
        </Link>
        <h1 className="kd-titre-1 mt-2 text-aubergine">Réglages</h1>
      </div>

      <section className="kd-carte gap-4 p-5">
        <div>
          <p className="kd-etiquette">Ce téléphone est celui de</p>
          <p className="kd-titre-2 mt-1 text-aubergine">{me.name}</p>
        </div>
        <div>
          <p className="kd-etiquette mb-2">Style de l&apos;appli</p>
          <MyStyle me={me} />
        </div>
        <form action={forgetProfile}>
          <button className="min-h-14 text-encre-douce underline underline-offset-4">Ce n&apos;est pas moi</button>
        </form>
      </section>

      <NotificationsCard variant="full" />

      <div className="flex flex-col gap-3">
        <Link href={`/profil/gouts?suite=${encodeURIComponent("/reglages")}`} className={lien}>
          <span>Mes goûts</span>
          <IconeRetour className="size-6 rotate-180 text-violet" />
        </Link>
        <Link href="/famille" className={lien}>
          <span>Ma famille{family ? ` · ${family.name}` : ""}</span>
          <IconeRetour className="size-6 rotate-180 text-violet" />
        </Link>
        <Link href="/recettes" className={lien}>
          <span>Gérer les recettes</span>
          <IconeRetour className="size-6 rotate-180 text-violet" />
        </Link>
      </div>

      <form action={leaveFamily} className="mt-4 text-center">
        <button className="min-h-14 px-2 text-encre-douce underline underline-offset-4">Quitter cette famille sur ce téléphone</button>
      </form>
    </main>
  );
}
