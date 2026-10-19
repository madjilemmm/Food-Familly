import Link from "next/link";
import { IconeRetour } from "@/components/ui";
import { CreateFamilyForm } from "./CreateFamilyForm";

export const metadata = { title: "Créer ma famille — Kaddie" };

export default function CreateFamilyPage() {
  return (
    <main className="pt-safe pb-safe mx-auto max-w-md px-5 pb-16">
      <Link href="/bienvenue" className="-ml-2 inline-flex min-h-14 items-center gap-1 font-semibold text-violet">
        <IconeRetour className="size-6" /> Retour
      </Link>
      <h1 className="kd-titre-1 mt-2 text-aubergine">Créer ma famille</h1>
      <p className="mt-3 mb-6 text-encre-douce">
        Tu commences seul·e : swipe des plats, fais ta liste. Ta famille te rejoint quand elle veut.
      </p>
      <CreateFamilyForm />
    </main>
  );
}
