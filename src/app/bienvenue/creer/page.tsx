import Link from "next/link";
import { CreateFamilyForm } from "./CreateFamilyForm";

export const metadata = { title: "Créer ma famille — À table !" };

export default function CreateFamilyPage() {
  return (
    <main className="pt-safe pb-safe mx-auto max-w-md px-5 pb-16">
      <Link href="/bienvenue" className="inline-flex py-2 text-lg font-semibold text-tomato-600">
        ‹ Retour
      </Link>
      <h1 className="mt-2 text-3xl font-extrabold">Créer ma famille</h1>
      <p className="mt-2 mb-6 text-stone-600">
        Ajoutez chaque personne de la maison. Chacun pourra faire les courses, swiper et demander ses plats.
      </p>
      <CreateFamilyForm />
    </main>
  );
}
