import Link from "next/link";
import { requireFamily } from "@/lib/auth";
import { MemberForm } from "@/components/family/MemberForm";
import { addMyself } from "@/app/actions/auth";

export const metadata = { title: "Me rajouter — À table !" };

export default async function AddMyselfPage() {
  await requireFamily();
  return (
    <main className="pt-safe pb-safe mx-auto max-w-md px-6">
      <Link href="/profil" className="inline-flex py-2 text-lg font-semibold text-tomato-600">
        ‹ Retour
      </Link>
      <h1 className="mt-2 mb-6 text-3xl font-extrabold">Me rajouter à la famille</h1>
      <MemberForm action={addMyself} submitLabel="C'est parti !" />
    </main>
  );
}
