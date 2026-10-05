import Link from "next/link";
import { getMatches } from "@/lib/data";
import { getTripOverview } from "@/lib/views";
import { daysLeft } from "@/lib/domain/swipe-deck";
import { PageHeader } from "@/components/PageHeader";
import { RecipeVisual } from "@/components/RecipeVisual";
import { RecipeChecklist } from "@/components/parent/RecipeChecklist";

export default async function ParentMatches() {
  const [overview, matches] = await Promise.all([getTripOverview(), getMatches()]);

  return (
    <>
      <PageHeader title="Les plats qu'ils aiment" subtitle="Choisis par vos deux fils" />

      {matches.length === 0 ? (
        <p className="rounded-3xl bg-white p-6 text-xl text-stone-500">
          Pas encore de plat aimé par les deux. Ils choisissent sur leur téléphone ! 😊
        </p>
      ) : overview ? (
        <>
          <p className="mb-3 text-stone-500">Touchez un plat pour l&apos;ajouter aux courses.</p>
          <RecipeChecklist recipes={overview.candidates.filter((c) => c.isMatch)} />
        </>
      ) : (
        <>
          <ul className="space-y-3">
            {matches.map((m) => (
              <li key={m.id} className="flex items-center gap-4 rounded-3xl bg-white p-3">
                <RecipeVisual recipe={m} className="size-20 shrink-0 rounded-2xl" emojiClassName="text-4xl" />
                <span>
                  <span className="block text-xl font-bold">{m.title}</span>
                  <span className="text-base text-stone-500">encore {daysLeft(m.expires_at)} jours</span>
                </span>
              </li>
            ))}
          </ul>
          <Link
            href="/maman"
            className="mt-6 block rounded-[2rem] bg-tomato-500 py-5 text-center text-2xl font-bold text-white shadow-lg active:scale-[0.98]"
          >
            🛒 Lancer les courses pour les choisir
          </Link>
        </>
      )}

      <Link href="/recettes" className="mt-10 block py-3 text-center text-lg text-stone-500 underline">
        Gérer mes recettes
      </Link>
    </>
  );
}
