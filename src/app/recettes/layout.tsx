import Link from "next/link";
import { requireProfile } from "@/lib/auth";

export default async function RecipesLayout({ children }: { children: React.ReactNode }) {
  await requireProfile();
  return (
    <div className="mx-auto max-w-xl px-5 pb-16">
      <nav className="pt-safe pb-2">
        <Link href="/" className="inline-flex items-center gap-1 py-2 text-lg font-semibold text-tomato-600">
          ‹ Retour
        </Link>
      </nav>
      {children}
    </div>
  );
}
