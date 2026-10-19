import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { getFamilySwipes, getFamilyTastes, getMatches, getProfiles, getRecipeTexts, getRecipes } from "@/lib/data";
import { styleDe } from "@/lib/domain/envies";
import { portrait } from "@/lib/domain/portrait";
import { IconeRetour } from "@/components/ui";
import { PasVraiment } from "./PasVraiment";

export const metadata = { title: "Ton portrait gourmand — Kaddie" };
export const dynamic = "force-dynamic";

/** Ce que Kaddie a compris de moi : mes swipes et mes goûts, en phrases, que je peux corriger. */
export default async function PortraitPage() {
  const me = await requireProfile();
  const [swipes, recipes, texts, tastes, matches, profiles] = await Promise.all([
    getFamilySwipes(me.family_id),
    getRecipes(me.family_id),
    getRecipeTexts(me.family_id),
    getFamilyTastes(me.family_id),
    getMatches(me.family_id),
    getProfiles(me.family_id),
  ]);
  const minutes = new Map(recipes.map((r) => [r.id, r.total_minutes]));
  const aimes: { style: string | null; minutes: number | null }[] = [];
  const refuses: { style: string | null }[] = [];
  for (const [recipeId, parMembre] of swipes) {
    const avis = parMembre.get(me.id);
    if (!avis || !texts.has(recipeId)) continue;
    const style = styleDe(texts.get(recipeId)!);
    if (avis.likedAt != null) aimes.push({ style, minutes: minutes.get(recipeId) ?? null });
    else if (!avis.liked) refuses.push({ style });
  }
  const gouts = tastes.members.find((m) => m.id === me.id)?.tastes ?? {};
  const { traits, aSwiper } = portrait({ aimes, refuses, gouts });
  const enCommun = profiles
    .filter((p) => p.id !== me.id)
    .map((p) => ({ name: p.name, n: matches.filter((m) => m.likers.includes(me.id) && m.likers.includes(p.id)).length }))
    .filter((x) => x.n > 0);

  return (
    <main className="pt-safe pb-safe mx-auto flex max-w-xl flex-col gap-8 px-5 pb-16">
      <div>
        <Link href="/reglages" className="-ml-2 inline-flex min-h-14 items-center gap-1 font-semibold text-violet">
          <IconeRetour className="size-6" /> Réglages
        </Link>
        <h1 className="kd-titre-1 mt-2 text-aubergine">Ton portrait gourmand</h1>
        <p className="mt-2 text-encre-douce">
          Ce que Kaddie a compris de toi, à partir de tes {aimes.length + refuses.length} swipes. Pas d&apos;accord ? Corrige-le.
        </p>
      </div>

      {traits.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {traits.map((t) => (
            <li key={t.id} className="flex min-h-14 items-center gap-3 rounded-bouton bg-blanc px-4 py-2">
              <span className="kd-titre-3 flex-1 text-aubergine">{t.texte}</span>
              {t.gout && <PasVraiment food={t.gout} />}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-encre-douce">Pas encore assez d&apos;indices pour dresser ton portrait.</p>
      )}

      {aSwiper > 0 && (
        <p>
          Encore {aSwiper} plat{aSwiper > 1 ? "s" : ""} à swiper et Kaddie te connaîtra mieux.{" "}
          <Link href="/envies" className="font-semibold text-violet underline underline-offset-4">
            Swiper
          </Link>
        </p>
      )}

      {enCommun.length > 0 && (
        <section>
          <h2 className="kd-etiquette mb-2">Avec ta famille</h2>
          <ul className="kd-liste border-t-2 border-trait">
            {enCommun.map((x) => (
              <li key={x.name} className="kd-liste__article min-h-14">
                {x.n} envie{x.n > 1 ? "s" : ""} en commun avec {x.name}
              </li>
            ))}
          </ul>
        </section>
      )}

      <Link href={`/profil/gouts?suite=${encodeURIComponent("/profil/portrait")}`} className="kd-btn kd-btn--secondaire kd-btn--large">
        Régime, allergies et goûts en détail
      </Link>
    </main>
  );
}
