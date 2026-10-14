import Link from "next/link";
import { requireFamily } from "@/lib/auth";
import { MemberForm } from "@/components/family/MemberForm";
import { addMyself } from "@/app/actions/auth";
import { IconeRetour } from "@/components/ui";

export const metadata = { title: "Me rajouter — Kaddie" };

export default async function AddMyselfPage() {
  await requireFamily();
  return (
    <main className="pt-safe pb-safe mx-auto max-w-md px-5">
      <Link href="/profil" className="-ml-2 inline-flex min-h-14 items-center gap-1 font-semibold text-violet">
        <IconeRetour className="size-6" /> Retour
      </Link>
      <h1 className="kd-titre-1 mt-2 mb-6 text-aubergine">Me rajouter à la famille</h1>
      <MemberForm action={addMyself} submitLabel="C'est parti" />
    </main>
  );
}
