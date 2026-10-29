import Link from "next/link";
import { IconeRetour } from "@/components/ui";

export const metadata = { title: "Confidentialité — Kaddie" };

/** Ce que Kaddie garde, pourquoi, qui le voit, et comment tout récupérer ou tout effacer. Lisible sans être connecté. */
export default function Confidentialite() {
  return (
    <main className="pt-safe pb-safe mx-auto flex max-w-xl flex-col gap-8 px-5 pb-16">
      <div>
        <Link href="/" className="-ml-2 inline-flex min-h-14 items-center gap-1 font-semibold text-violet">
          <IconeRetour className="size-6" /> Retour
        </Link>
        <h1 className="kd-titre-1 mt-2 text-aubergine">Confidentialité</h1>
        <p className="kd-petit mt-2">Mise à jour le 29 octobre 2026</p>
        <p className="mt-4">
          Kaddie est un projet personnel, sans publicité. Ce que vous y mettez sert uniquement à faire marcher l&apos;appli pour votre
          famille.
        </p>
      </div>

      <Partie titre="Ce que Kaddie garde">
        <li>
          <strong>La famille</strong> : son nom, son code, les prénoms des membres.
        </li>
        <li>
          <strong>Les goûts</strong> : régimes, allergies, ce que chacun aime ou non, ses envies (styles, temps, piquant). Régimes et
          allergies sont facultatifs : vous les donnez pour trier les recettes, et vous pouvez les retirer à tout moment dans Mes goûts.
        </li>
        <li>
          <strong>Ce que vous faites dans l&apos;appli</strong> : swipes, recettes et leurs photos, courses (listes, demandes, plats
          choisis).
        </li>
        <li>
          <strong>Les notifications</strong>, si vous les activez : l&apos;adresse technique donnée par le navigateur pour les recevoir.
        </li>
        <li>
          <strong>Sur le téléphone</strong> : deux cookies nécessaires au fonctionnement (la famille et le prénom choisis ; un
          identifiant pour la mise à jour en direct) et, sans réseau, les changements en attente. Aucun cookie publicitaire ni de
          mesure d&apos;audience.
        </li>
        <li>
          <strong>Des compteurs anonymes</strong> : combien de fois par jour chaque étape du début est atteinte (accueil affiché, famille
          créée, premier plat choisi, liste ouverte, lien partagé). Un simple total, sans identifiant, sans famille ni prénom : on ne
          peut pas savoir qui.
        </li>
        <li>
          <strong>La sécurité</strong> : après un code famille erroné, une empreinte de l&apos;adresse internet (jamais l&apos;adresse
          elle-même), effacée au bout de 24 heures ; les liens d&apos;invitation, valables 7 jours.
        </li>
      </Partie>

      <Partie titre="Qui y a accès">
        <li>Les membres de votre famille, dans l&apos;appli. Personne d&apos;autre.</li>
        <li>
          Les prestataires qui font tourner Kaddie, uniquement pour l&apos;héberger : Vercel (l&apos;appli) et Supabase (la base de
          données et les photos). Les notifications passent par le service du navigateur (Apple, Google ou Mozilla).
        </li>
        <li>Rien n&apos;est vendu, ni utilisé pour de la publicité.</li>
      </Partie>

      <Partie titre="Combien de temps">
        <li>Tant que la famille existe : les courses passées servent par exemple à proposer les achats habituels.</li>
        <li>Supprimer la famille efface tout, tout de suite, pour tous les téléphones.</li>
      </Partie>

      <Partie titre="Vos droits">
        <li>
          Consulter et emporter : <strong>Réglages → Exporter les données de la famille</strong> (un fichier avec tout).
        </li>
        <li>
          Corriger : <strong>Réglages → Mes goûts</strong>, et <strong>Ma famille</strong> pour les prénoms et les membres.
        </li>
        <li>
          Effacer : <strong>Réglages → Supprimer la famille et ses données</strong>.
        </li>
        <li>
          Vous pouvez aussi adresser une réclamation à la CNIL (
          <a href="https://www.cnil.fr" className="text-violet underline underline-offset-4">
            cnil.fr
          </a>
          ).
        </li>
      </Partie>

      <Partie titre="Les moins de 15 ans">
        <li>
          En France, avant 15 ans, l&apos;accord d&apos;un parent est nécessaire pour consentir à l&apos;utilisation de ses données.
          C&apos;est un adulte qui crée la famille et y ajoute les enfants ; il peut retirer un profil à tout moment.
        </li>
      </Partie>

      <Partie titre="Mentions légales">
        <li>Éditeur : Kaddie, projet personnel non commercial.</li>
        <li>Hébergement : Vercel Inc. (vercel.com) pour l&apos;appli ; Supabase Inc. (supabase.com) pour les données.</li>
      </Partie>
    </main>
  );
}

function Partie({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="kd-titre-3 mb-3 text-aubergine">{titre}</h2>
      <ul className="flex list-disc flex-col gap-2 pl-5 marker:text-violet">{children}</ul>
    </section>
  );
}
