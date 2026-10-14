import { requireProfile } from "@/lib/auth";
import { getFamilyTastes, getProfiles } from "@/lib/data";
import { ROUTES } from "@/lib/routes";
import { AUTRE, DIETS } from "@/lib/domain/foods";
import { Questionnaire } from "./Questionnaire";

export const metadata = { title: "Mes goûts — Kaddie" };
export const dynamic = "force-dynamic";

/** Seulement un chemin de l'appli (jamais un autre site). */
function safeNext(raw: string | undefined, fallback: string) {
  return raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : fallback;
}

export default async function TastesPage({ searchParams }: { searchParams: Promise<{ suite?: string }> }) {
  const me = await requireProfile();
  const [{ members }, profiles, params] = await Promise.all([getFamilyTastes(me.family_id), getProfiles(me.family_id), searchParams]);
  const mine = members.find((m) => m.id === me.id)?.tastes ?? {};
  const dietKeys = new Set(DIETS.map((d) => d.key));
  const done = new Map(profiles.map((p) => [p.id, Boolean(p.tastes_done_at)]));

  return (
    <Questionnaire
      style={me.style}
      suite={safeNext(params.suite, ROUTES[me.style].home)}
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
