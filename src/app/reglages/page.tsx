import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { forgetProfile } from "@/app/actions/auth";
import { NotificationsCard } from "@/components/pwa/NotificationsCard";

export const metadata = { title: "Réglages — À table !" };

export default async function SettingsPage() {
  const me = await requireProfile();
  return (
    <main className="pt-safe pb-safe mx-auto max-w-xl px-5 text-lg">
      <Link href="/" className="inline-flex py-2 font-semibold text-tomato-600">
        ‹ Retour
      </Link>
      <h1 className="mt-2 mb-6 text-3xl font-extrabold">Réglages</h1>

      <section className="mb-6 rounded-3xl bg-white p-5">
        <p className="text-stone-500">Ce téléphone est celui de</p>
        <p className="mt-1 flex items-center gap-3 text-2xl font-bold">
          <span className="text-4xl">{me.emoji}</span> {me.name}
        </p>
        <form action={forgetProfile} className="mt-4">
          <button className="text-stone-500 underline">Ce n&apos;est pas moi</button>
        </form>
      </section>

      <NotificationsCard variant="full" />

      <Link href="/recettes" className="block rounded-3xl bg-white p-5 font-semibold">
        📖 Gérer les recettes
      </Link>
    </main>
  );
}
