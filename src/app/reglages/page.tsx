import Link from "next/link";
import { requireProfile, requireUser } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { getFamily } from "@/lib/data";
import { forgetProfile, leaveFamily } from "@/app/actions/auth";
import { NotificationsCard } from "@/components/pwa/NotificationsCard";
import { MyStyle } from "@/components/family/MyStyle";

export const metadata = { title: "Réglages — À table !" };

export default async function SettingsPage() {
  const user = await requireUser();
  const [me, family] = await Promise.all([requireProfile(), getFamily(user.familyId)]);
  return (
    <main className="pt-safe pb-safe mx-auto max-w-xl px-5 pb-16 text-lg">
      <Link href={ROUTES[me.style].home} className="inline-flex py-2 font-semibold text-tomato-600">
        ‹ Retour
      </Link>
      <h1 className="mt-2 mb-6 text-3xl font-extrabold">Réglages</h1>

      <section className="mb-6 rounded-3xl bg-white p-5">
        <p className="text-stone-500">Ce téléphone est celui de</p>
        <p className="mt-1 flex items-center gap-3 text-2xl font-bold">
          <span className="text-4xl">{me.emoji}</span> {me.name}
        </p>
        <div className="mt-4">
          <p className="mb-2 font-semibold">Style de l&apos;appli</p>
          <MyStyle me={me} />
        </div>
        <form action={forgetProfile} className="mt-4">
          <button className="min-h-11 text-stone-500 underline">Ce n&apos;est pas moi</button>
        </form>
      </section>

      <NotificationsCard variant="full" />

      <Link href="/famille" className="mb-3 flex items-center justify-between rounded-3xl bg-white p-5 font-semibold">
        <span>👨‍👩‍👧‍👦 Ma famille{family ? ` · ${family.name}` : ""}</span>
        <span className="text-stone-300">›</span>
      </Link>
      <Link href="/recettes" className="flex items-center justify-between rounded-3xl bg-white p-5 font-semibold">
        <span>📖 Gérer les recettes</span>
        <span className="text-stone-300">›</span>
      </Link>

      <form action={leaveFamily} className="mt-10 text-center">
        <button className="min-h-11 px-2 text-base text-stone-400 underline">Quitter cette famille sur ce téléphone</button>
      </form>
    </main>
  );
}
