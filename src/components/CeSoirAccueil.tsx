import Link from "next/link";
import { cookies } from "next/headers";
import type { Profile, Recipe, Trip } from "@/lib/data";
import {
  forFamily,
  getCeSoirChoisi,
  getDeck,
  getFamilyEnvies,
  getFamilySwipes,
  getFoyer,
  getPasCeSoir,
  getProfiles,
  getRecipe,
  getRecipes,
  getRepasAchetes,
  getRepasManges,
  getTasteContext,
} from "@/lib/data";
import { platsDuMenu } from "@/lib/menu";
import { choisirCeSoir, PREVENU_COOKIE } from "@/lib/domain/ce-soir";
import { allergenesSurLaCarte } from "@/lib/domain/foods";
import { estPourLaRecette } from "@/lib/domain/shopping-list";
import { jourAParis } from "@/lib/domain/heure";
import { commeVoulu, histoireDesRepas, platsARefaire, raisonDuSoir } from "@/lib/domain/memoire";
import { RecipeVisual } from "@/components/RecipeVisual";
import { BoutonCommande } from "@/components/BoutonCommande";
import { CaddieArrive } from "@/components/CaddieArrive";
import { PartagerRepas } from "@/components/PartagerRepas";
import { QuestionPrevenir } from "@/components/QuestionPrevenir";
import { Logo } from "@/design-system/components/Kaddie";
import {
  IconeAutre,
  IconeCoche,
  IconePanier,
  IconeRetour,
} from "@/components/ui";
const JOUR = 86_400_000;
/** Au moins ce nombre de plats à proposer : le paquet de Kaddie complète ce qui est acheté, au Menu ou envié. */
const PROPOSITIONS_MIN = 6;
const LIEN_ALLERGIES = `/profil/gouts?regime=1&suite=${encodeURIComponent("/menu")}`;

const enSemaine = () =>
  ["lun.", "mar.", "mer.", "jeu."].includes(
    new Intl.DateTimeFormat("fr-FR", {
      weekday: "short",
      timeZone: "Europe/Paris",
    }).format(new Date()),
  );

type Origine = "achete" | "menu" | "envie" | "refait" | "idee";

/** Pour les ingrédients : sans la quantité (« 2 oignons » devient « oignons »). */
const sansQuantite = (nom: string) =>
  nom
    .replace(/^\d+([.,]\d+)?\s*(kg|g|cl|ml|l|boîtes?|pots?)?\s*(de |d')?/i, "")
    .trim() || nom;

/**
 * « Ce soir » : une réponse à « on mange quoi ? ». Tant que personne n'a rien retenu, UNE proposition
 * (règles : domain/ce-soir.ts) avec « Ce sera ça » et « Autre idée » ; une fois retenue, le repas du soir,
 * ce qu'il reste à faire pour lui, et son caddie.
 */
export async function CeSoirAccueil({
  me,
  trip,
  i = 0,
}: {
  me: Profile;
  trip: Trip;
  i?: number;
}): Promise<{ node: React.ReactNode; platId: string | null }> {
  const [
    choisi,
    repas,
    envies,
    recipes,
    profiles,
    pasCeSoir,
    avis,
    ctx,
    manges,
    foyer,
    detailChoisi,
  ] = await Promise.all([
    getCeSoirChoisi(me.family_id),
    getRepasAchetes(me.family_id),
    getFamilyEnvies(me.family_id),
    getRecipes(me.family_id),
    getProfiles(me.family_id),
    getPasCeSoir(me.family_id),
    getFamilySwipes(me.family_id),
    getTasteContext(me.family_id),
    getRepasManges(me.family_id),
    getFoyer(me.family_id),
    // La fiche du plat décidé (ses étapes : « Je cuisine » ou « Voir la recette ») part avec le reste, sans attendre.
    getCeSoirChoisi(me.family_id).then((c) => (c ? getRecipe(me.family_id, c.recipeId) : null)),
  ]);
  const parId = new Map(recipes.map((r) => [r.id, r]));
  const noms = new Map(profiles.map((p) => [p.id, p.name]));
  const allergieAVoir = !me.tastes_seen_at;
  // Ce que la maison a mangé, jour par jour (« C'est fait », ou décidé et courses faites) : la phrase datée sous le plat.
  const histoires = histoireDesRepas(manges.filter((r) => !r.provisoire));

  // ─── Le repas de ce soir est retenu ───
  const retenu = choisi ? parId.get(choisi.recipeId) : undefined;
  if (retenu) {
    // Un titre peut contenir une virgule : on lit « pour A, B » avec les titres de la famille.
    const titres = recipes.map((r) => r.title);
    const ingredients = trip.shopping_list_items.filter((l) => l.source === "recipe" && estPourLaRecette(l.for_recipes, retenu.title, titres));
    const parQui = choisi?.choisiPar
      ? choisi.choisiPar === me.id
        ? "toi"
        : noms.get(choisi.choisiPar)
      : null;
    const contient = allergenesSurLaCarte(ctx.texts.get(retenu.id) ?? [retenu.title]);
    const achete = (repas?.plats ?? []).some(
      (p) => p.id === retenu.id && !p.fait,
    );
    // Sans étapes (recette à peine saisie), « Je cuisine » n'a rien à ouvrir : la fiche de la recette suffit.
    const detail = detailChoisi;
    const cuisinable = (detail?.steps?.length ?? 0) > 0;
    // Le prochain pas utile : acheter tant que la liste n'est pas faite, puis cuisiner.
    const resteAAcheter = ingredients.some((l) => !l.checked);
    const listeDabord = !achete && resteAAcheter;
    const jeChoisis = !choisi?.choisiPar || choisi.choisiPar === me.id;
    // Celles et ceux qui en avaient envie : « comme Karin le voulait » dans le message, « ton envie » sur leur écran.
    const enviePar = envies.get(retenu.id) ?? [];
    const maEnvie = !jeChoisis && enviePar.includes(me.id);
    const autresEnvies = enviePar.filter((id) => id !== me.id).flatMap((id) => noms.get(id) ?? []);
    // « Prévenir la famille ? » : une fois par dîner et par téléphone, juste après « Ce sera ça », quand il y a quelqu'un à prévenir.
    const quelquUnAPrevenir = profiles.length > 1 || (foyer ?? 1) > 1;
    const dejaRepondu = (await cookies()).get(PREVENU_COOKIE)?.value === jourAParis();
    const questionPrevenir = jeChoisis && quelquUnAPrevenir && !dejaRepondu;
    const lienRecette = `/recettes/${retenu.id}?depuis=/menu${cuisinable ? "&cuisine=1" : ""}`;
    const libelleRecette = cuisinable ? "Je cuisine" : "Voir la recette";
    const node = (
      <section
        className="kd-monte flex min-h-0 flex-1 flex-col"
        aria-label="Le repas de ce soir"
      >
        <div className="soir-haut">
          <Photo recipe={retenu} lien={`/recettes/${retenu.id}?depuis=/menu`} />
          <p className="mt-4 flex min-h-6 items-center gap-2.5 text-petit text-encre-douce">
            <span className="kd-pop inline-flex items-center gap-1.5 rounded-pastille bg-pistache py-0.5 pr-2.5 pl-1.5 text-etiquette font-semibold tracking-wider text-aubergine uppercase">
              <IconeCoche className="size-4" /> Décidé
            </span>
            {parQui && (
              <span>
                choisi par <strong className="text-encre">{parQui}</strong>
                {maEnvie && (
                  <>
                    {" "}
                    · <span className="font-semibold text-violet">ton envie</span>
                  </>
                )}
              </span>
            )}
            {jeChoisis && (
              <PartagerRepas
                titre={retenu.title}
                articles={ingredients.length}
                photo={retenu.photo_url}
                commeVoulu={commeVoulu(autresEnvies)}
              />
            )}
          </p>
          <h2 className="kd-titre-2 mt-1.5 text-aubergine">{retenu.title}</h2>
          <p className="mt-1 min-h-5 text-petit text-encre-douce">
            {[
              retenu.total_minutes ? `${retenu.total_minutes} min` : null,
              contient,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>

          {allergieAVoir ? <QuestionAllergie /> : questionPrevenir && <QuestionPrevenir />}

          <CaddieArrive recipeId={retenu.id}>
          <Link
            href="/courses"
            className="soir-ligne mt-3 flex min-h-14 items-center gap-3 border-t-2 border-trait text-petit font-medium active:bg-trait/40"
          >
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-pistache text-aubergine">
              <IconeCoche className="size-3.5" />
            </span>
            <span className="flex-1">
              {achete
                ? "Déjà acheté"
                : ingredients.length
                  ? `${ingredients.length} article${ingredients.length > 1 ? "s" : ""} dans le caddie`
                  : "Les ingrédients arrivent dans le caddie"}
            </span>
            <IconeRetour className="size-5 rotate-180 text-violet" />
          </Link>
          </CaddieArrive>
        </div>
        <div className="soir-bas">
          <Link
            href={listeDabord ? "/courses" : lienRecette}
            className="kd-btn kd-btn--large w-full"
          >
            {listeDabord ? "Voir la liste de courses" : libelleRecette}
          </Link>
          <div className="flex items-center justify-center">
            {listeDabord && jeChoisis && (
              <>
                <Link
                  href={lienRecette}
                  className="flex min-h-11 items-center px-3 font-semibold text-violet"
                >
                  {libelleRecette}
                </Link>
                <span aria-hidden className="size-1 rounded-full bg-trait" />
              </>
            )}
            <BoutonCommande
              commande="changer"
              className="flex min-h-11 items-center gap-2 px-3 font-semibold text-violet"
            >
              Changer de plat
            </BoutonCommande>
          </div>
        </div>
      </section>
    );
    return { node, platId: retenu.id };
  }

  // ─── Une proposition ───
  const menu = new Set(platsDuMenu(trip));
  const achetes = (repas?.plats ?? []).filter((p) => !p.fait);
  const joursAchat = repas ? Math.max(0, (Date.now() - repas.le) / JOUR) : 0;
  const nbEnvies = (id: string) => envies.get(id)?.length ?? 0;
  const candidats: (Recipe & {
    achete: boolean;
    joursDepuisAchat: number;
    envies: number;
    minutes: number | null;
    auMenu: boolean;
    rang?: number;
    refait: number | null;
    origine: Origine;
  })[] = [];
  // Mes plats à refaire : aimés (ou classiques), déjà mangés, pas depuis une semaine. Jamais un plat que j'ai écarté.
  const maintenant = Date.now();
  const avisDe = (id: string) => avis.get(id)?.get(me.id);
  const aRefaire = new Map(
    platsARefaire(histoires, {
      aimes: new Set([...avis.keys()].filter((id) => avisDe(id)?.liked === true)),
      ecartes: new Set([...avis.keys()].filter((id) => avisDe(id)?.liked === false)),
      now: maintenant,
    }).map((x) => [x.recipeId, x.jours]),
  );
  const vus = new Set<string>();
  const ajouter = (r: Recipe, origine: Origine, rang?: number) => {
    if (vus.has(r.id)) return;
    vus.add(r.id);
    candidats.push({
      ...r,
      achete: origine === "achete",
      joursDepuisAchat: origine === "achete" ? joursAchat : 0,
      envies: nbEnvies(r.id),
      minutes: r.total_minutes,
      auMenu: origine === "menu",
      rang,
      refait: aRefaire.get(r.id) ?? null,
      origine,
    });
  };
  for (const p of achetes) ajouter(p, "achete");
  for (const id of menu) if (parId.has(id)) ajouter(parId.get(id)!, "menu");
  for (const id of envies.keys())
    if (parId.has(id)) ajouter(parId.get(id)!, "envie");
  // Un plat aimé et déjà mangé revient devant une idée neuve (jamais devant une envie ni un plat acheté).
  for (const id of aRefaire.keys()) if (parId.has(id)) ajouter(parId.get(id)!, "refait");
  // Rien d'acheté, au Menu ni envié : Kaddie propose quand même, le haut de son paquet (jamais un plat que j'ai écarté).
  if (candidats.length < PROPOSITIONS_MIN) {
    const paquet = await getDeck(me.family_id, me.id);
    paquet
      .filter(
        (r) =>
          !r.hier && !r.pastille && avis.get(r.id)?.get(me.id)?.liked !== false,
      )
      .slice(0, PROPOSITIONS_MIN * 2)
      .forEach((r, rang) => ajouter(r, "idee", rang));
  }
  const possibles = await forFamily(me.family_id, candidats);
  const choix = choisirCeSoir(possibles, { semaine: enSemaine(), pasCeSoir });
  if (choix.length === 0) return { node: null, platId: null };
  const idx = Math.max(0, i || 0);
  const plat = choix[idx % choix.length];
  const qui = (envies.get(plat.id) ?? []).flatMap((id) => noms.get(id) ?? []);
  const histoire = histoires.get(plat.id);
  const monAvis = avisDe(plat.id);
  const aime = monAvis?.liked === true;
  // Une phrase qui dit pourquoi ce plat, la plus vraie, datée quand la date est connue (domain/memoire.ts), sans mot interne
  // (« à acheter », « au Menu »). Sa clé est gardée avec la décision, pour voir ce qui convainc.
  const { texte: raison, raison: cleRaison } = raisonDuSoir(
    { achete: plat.origine === "achete", qui, histoire, aime, adore: aime && histoire != null && (monAvis?.likedAt ?? 0) >= histoire.dernier },
    { moi: me.name, now: maintenant },
  );
  const contient = allergenesSurLaCarte(ctx.texts.get(plat.id) ?? [plat.title]);
  // Le nombre de personnes à table : celui de la course, sinon le foyer dit à la création, sinon la famille.
  const pour = trip.people ?? Math.max(foyer ?? 1, profiles.length);
  // Les ingrédients du plat : déjà chargés avec le titre (domain/foods.ts), pas de requête de plus.
  const noms2 = (ctx.texts.get(plat.id) ?? [plat.title]).slice(1).map((nom) => sansQuantite(nom));
  const lien = `/recettes/${plat.id}?depuis=/menu`;

  const node = (
    <section
      className="kd-monte flex min-h-0 flex-1 flex-col"
      key={plat.id}
      aria-label="La proposition de ce soir"
    >
      <div className="soir-haut">
        <Photo recipe={plat} lien={lien} />
        <p className="mt-4 flex min-h-6 items-center gap-2.5 text-petit text-encre-douce">
          {plat.origine === "idee" || plat.origine === "refait" ? (
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-violet text-blanc">
              <Logo variante="monogramme" width={11} title="" />
            </span>
          ) : (
            <span className="flex shrink-0">
              {profiles.slice(0, 4).map((p, k) => (
                <span
                  key={p.id}
                  className={`flex size-6 items-center justify-center rounded-full border-2 border-fond text-etiquette leading-none font-semibold ${k ? "-ml-1.5" : ""} ${
                    qui.includes(p.name)
                      ? "bg-aubergine text-blanc"
                      : "bg-fond text-encre-douce ring-2 ring-trait ring-inset"
                  }`}
                >
                  {p.name.slice(0, 1).toUpperCase()}
                </span>
              ))}
            </span>
          )}
          <span>{raison}</span>
        </p>
        <h2 className="kd-titre-2 mt-1.5 text-aubergine">{plat.title}</h2>
        <p className="mt-1 min-h-5 text-petit text-encre-douce">
          {[plat.minutes ? `${plat.minutes} min` : null, contient]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {noms2.length > 0 && (
          <div className="soir-ligne mt-3 flex min-h-14 items-center gap-3 border-t-2 border-trait text-petit font-medium">
            <IconePanier className="size-6 shrink-0 text-aubergine" />
            <span className="flex-1">
              {noms2.length} article{noms2.length > 1 ? "s" : ""}{" "}
              {plat.origine === "menu"
                ? "déjà dans le caddie"
                : noms2.length > 1
                  ? "iront dans le caddie"
                  : "ira dans le caddie"}
            </span>
            <BoutonCommande
              commande="foyer"
              n={pour >= 6 ? 1 : pour + 1}
              aria-label={`pour ${pour}, changer le nombre de personnes à table`}
              className="flex min-h-11 shrink-0 items-center px-1 font-semibold text-violet underline decoration-dotted underline-offset-4"
            >
              pour {pour}
            </BoutonCommande>
          </div>
        )}
      </div>
      <div className="soir-bas">
        <BoutonCommande
          commande="ceSeraCa"
          recipeId={plat.id}
          raison={cleRaison}
          className="kd-btn kd-btn--large w-full"
          pendingLabel="Je mets au caddie…"
          annulable={{ message: `Au menu ce soir : ${plat.title}`, detail: noms2.length > 0 ? `${noms2.length} article${noms2.length > 1 ? "s" : ""} dans le caddie` : undefined }}
        >
          Ce sera ça
        </BoutonCommande>
        {choix.length > 1 && (
          <BoutonCommande
            commande="autreIdee"
            recipeId={plat.id}
            className="flex min-h-11 items-center gap-2 self-center px-4 font-semibold text-violet"
          >
            <IconeAutre className="size-5" /> Autre idée
          </BoutonCommande>
        )}
      </div>
    </section>
  );
  return { node, platId: plat.id };
}

/** La photo du plat : elle prend la hauteur que le texte et le bouton lui laissent, et mord de 28 px sur le bandeau. */
function Photo({ recipe, lien }: { recipe: Recipe; lien: string }) {
  return (
    <Link
      href={lien}
      aria-label={`Voir la recette : ${recipe.title}`}
      className="relative min-h-[7.5rem] flex-1 overflow-hidden rounded-[0.875rem] bg-trait active:opacity-90 [@media(max-height:660px)]:min-h-24"
    >
      <RecipeVisual recipe={recipe} className="absolute inset-0 size-full" />
    </Link>
  );
}

/** Une seule question, une seule fois : « Non » ne la repose plus ; « Oui » ouvre le choix des allergies et régimes. */
function QuestionAllergie() {
  return (
    <section
      aria-label="Allergie ou régime"
      className="soir-question mt-3 flex flex-wrap items-center gap-3 border-t-2 border-trait pt-3.5"
    >
      <p className="basis-full text-petit font-medium">
        <span className="soir-q-long">
          Une allergie ou un régime à signaler ?
        </span>
        <span className="soir-q-court" aria-hidden="true">
          Allergie ou régime ?
        </span>
      </p>
      <BoutonCommande
        commande="allergie"
        className="min-h-11 min-w-22 rounded-[0.875rem] border-[3px] border-aubergine px-4 font-semibold text-aubergine"
      >
        Non
      </BoutonCommande>
      <Link
        href={LIEN_ALLERGIES}
        className="flex min-h-11 min-w-22 items-center justify-center rounded-[0.875rem] border-[3px] border-aubergine px-4 font-semibold text-aubergine"
      >
        Oui
      </Link>
    </section>
  );
}
