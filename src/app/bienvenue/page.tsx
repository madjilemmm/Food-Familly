import Link from "next/link";
import { FamilyCodeForm } from "./FamilyCodeForm";
import { InstallFirst } from "./InstallFirst";

export const metadata = { title: "Bienvenue — Kaddie" };

export default function WelcomePage() {
  return (
    <main className="pt-safe pb-safe mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6">
      <div className="mb-8 text-center">
        <div className="mb-4 text-7xl">🍽️</div>
        <h1 className="text-4xl font-extrabold tracking-tight">Kaddie</h1>
        <p className="mt-3 text-lg text-stone-600">Les courses et les repas de la famille, sans prise de tête.</p>
      </div>
      <InstallFirst>
        <section className="rounded-3xl bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-xl font-bold">🔑 J&apos;ai un code famille</h2>
          <FamilyCodeForm />
        </section>
        <div className="my-5 flex items-center gap-3 text-stone-400">
          <span className="h-px flex-1 bg-stone-200" /> ou <span className="h-px flex-1 bg-stone-200" />
        </div>
        <Link
          href="/bienvenue/creer"
          className="flex items-center gap-4 rounded-3xl bg-gradient-to-br from-orange-400 to-tomato-500 p-5 text-white shadow-lg active:scale-[0.98]"
        >
          <span className="text-4xl">👨‍👩‍👧‍👦</span>
          <span>
            <span className="block text-xl font-extrabold">Créer ma famille</span>
            <span className="text-white/90">Ajoutez chaque membre, puis partagez le code.</span>
          </span>
        </Link>
      </InstallFirst>
    </main>
  );
}
