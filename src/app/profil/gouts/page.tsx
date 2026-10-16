import { requireProfile } from "@/lib/auth";
import { getFamilyTastes, getProfiles } from "@/lib/data";
import { AUTRE, DIETS, doitVoirNouvellesCartes } from "@/lib/domain/foods";
import { lireEnvies } from "@/lib/domain/envies";
import { Questionnaire } from "./Questionnaire";

export const metadata = { title: "Mes goûts — Kaddie" };
export const dynamic = "force-dynamic";

/** Seulement un chemin de l'appli (jamais un autre site). */
function safeNext(raw: string | undefined, fallback: string) {
  return raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : fallback;
}

export default async function TastesPage({ searchParams }: { searchParams: Promise<{ suite?: string; nouvelles?: string; envies?: string }> }) {
  const me = await requireProfile();
  const [{ members }, profiles, params] = await Promise.all([getFamilyTastes(me.family_id), getProfiles(me.family_id), searchParams]);
  const mine = members.find((m) => m.id === me.id)?.tastes ?? {};
  const dietKeys = new Set(DIETS.map((d) => d.key));
  const done = new Map(profiles.map((p) => [p.id, Boolean(p.tastes_done_at)]));

  return (
    <Questionnaire
      nouvelles={params.nouvelles === "1" && doitVoirNouvellesCartes(me.tastes_done_at)}
      enviesSeules={params.envies === "1" && Boolean(me.tastes_done_at) && !me.envies_done_at}
      commencerParEnvies={!me.envies_done_at}
      initialEnvies={{
        ...lireEnvies(me.envies),
        // Avant l'écran des envies, le piquant venait de la carte « Piment ».
        ...(!me.envies_done_at && mine.piment === "pas_fan" ? { piquant: "non" as const } : {}),
        ...(!me.envies_done_at && mine.piment === "adore" ? { piquant: "oui" as const } : {}),
      }}
      suite={safeNext(params.suite, "/")}
      initial={{
        diets: Object.entries(mine).filter(([k, l]) => l === "interdit" && dietKeys.has(k)).map(([k]) => k),
        autres: Object.keys(mine).filter((k) => k.startsWith(AUTRE)).map((k) => k.slice(AUTRE.length)),
        cards: Object.fromEntries(
          Object.entries(mine).filter(([, l]) => l === "pas_fan" || l === "adore").map(([k, l]) => [k, l === "adore" ? "adore" : "pas_fan"]),
        ),
      }}
      others={members
        .filter((m) => m.id !== me.id)
        .map((m) => ({ name: m.name, done: done.get(m.id) ?? false, tastes: m.tastes }))}
    />
  );
}
