import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { getAnnee } from "@/lib/data";
import { BandeauScene, EtatVide } from "@/components/ui";
import { PartagerSemaine } from "@/components/courses/PartagerSemaine";

export const metadata = { title: "Notre année à table — Kaddie" };
export const dynamic = "force-dynamic";

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? "s" : ""}`;

/** « Notre année à table » : le bilan de la famille depuis le 1er janvier, à partager. */
export default async function Annee() {
  const me = await requireProfile();
  const annee = await getAnnee(me.family_id);
  if (!annee) return null;
  const nom = (id: string) => (id === me.id ? "Toi" : (annee.noms.get(id) ?? "Quelqu'un"));
  const cartes = [
    annee.diners > 0 && { chiffre: pluriel(annee.diners, "plat"), phrase: "choisis ensemble, en un swipe" },
    annee.platStar && { chiffre: annee.titres.get(annee.platStar.id) ?? "", phrase: `Le plat de l'année : ${annee.platStar.fois} fois sur la liste` },
    annee.duo && { chiffre: `${nom(annee.duo.a)} & ${nom(annee.duo.b)}`, phrase: `Le duo de l'année : ${pluriel(annee.duo.matchs, "envie")} en commun` },
    annee.champion && { chiffre: nom(annee.champion.id), phrase: `a fait les courses ${annee.champion.fois} fois${annee.mercis ? ` · ${pluriel(annee.mercis, "merci")} reçus en tout` : ""}` },
    annee.cuisines > 0 && { chiffre: pluriel(annee.cuisines, "repas"), phrase: annee.cuisines > 1 ? "cuisinés avec Kaddie" : "cuisiné avec Kaddie" },
    annee.swipes > 0 && { chiffre: pluriel(annee.swipes, "swipe"), phrase: `pour ${pluriel(annee.courses, "course")}` },
  ].filter((c): c is { chiffre: string; phrase: string } => Boolean(c));

  return (
    <>
      <BandeauScene illustration="table" etiquette={`${annee.an} chez ${annee.famille}`} titre="Notre année à table" />
      {annee.courses === 0 ? (
        <EtatVide phrase="Pas encore de courses faites ensemble cette année. Le bilan se remplit à chaque course.">
          <Link href="/courses" className="kd-btn kd-btn--secondaire min-h-12 px-5">
            Préparer des courses
          </Link>
        </EtatVide>
      ) : (
        <>
          <ul className="flex flex-col gap-4">
            {cartes.map((c, i) => (
              <li key={c.phrase} className="kd-carte kd-monte gap-1 p-5" style={{ animationDelay: `${i * 90}ms` }}>
                <p className="kd-titre-1 text-aubergine">{c.chiffre}</p>
                <p className="text-encre-douce">{c.phrase}</p>
              </li>
            ))}
          </ul>
          <div className="mt-6 flex flex-col items-start gap-2">
            <PartagerSemaine
              url="/api/annee"
              nom={`kaddie-${annee.an}.png`}
              titre={`Notre année ${annee.an} à table`}
              libelle="Partager notre année"
              className="kd-btn kd-btn--large w-full"
            />
          </div>
        </>
      )}
    </>
  );
}
