import Link from "next/link";
import { requireProfile, requireUser } from "@/lib/auth";
import { getFamily, getProfiles } from "@/lib/data";
import { deleteFamily, forgetProfile } from "@/app/actions/auth";
import { QuitterFamille } from "@/components/pwa/QuitterFamille";
import { NotificationsCard } from "@/components/pwa/NotificationsCard";
import { BandeauScene, IconeRetour } from "@/components/ui";
import { CodeFamille } from "@/components/family/FamilyCode";
import { StrictToggle } from "@/components/family/StrictToggle";
import { ConfirmButton } from "@/components/courses/ConfirmButton";

export const metadata = { title: "Réglages — Kaddie" };

/** Des sections séparées par l'espace, pas des cartes empilées. */
export default async function SettingsPage() {
  const user = await requireUser();
  const [me, family, members] = await Promise.all([requireProfile(), getFamily(user.familyId), getProfiles(user.familyId)]);
  const liens = [
    { href: "/profil/portrait", label: "Ton portrait gourmand", detail: "Ce que Kaddie a compris de toi" },
    { href: "/annee", label: "Notre année à table", detail: "Le bilan de la famille, à partager" },
    { href: `/profil/gouts?suite=${encodeURIComponent("/reglages")}`, label: "Mes goûts", detail: "Allergies, envies, j'aime / j'aime pas" },
  ];
  return (
    <main className="ecran-famille mx-auto flex max-w-xl flex-col gap-10 px-5">
      {/* Le même bandeau que La table, dont on vient : le rond y ramène. */}
      <BandeauScene
        compact
        fond="courses"
        illustration="courses"
        etiquette={family?.name ?? "Ta famille"}
        titre="Réglages"
        reglages={false}
        actions={
          <Link href="/famille" aria-label="Retour à La table" className="flex size-14 shrink-0 items-center justify-center rounded-full bg-blanc text-aubergine active:scale-95">
            <IconeRetour className="size-7" />
          </Link>
        }
      />

      <section className="flex flex-col gap-3">
        <div>
          <p className="kd-etiquette">Ce téléphone est celui de</p>
          <p className="kd-titre-2 mt-1 text-aubergine">{me.name}</p>
        </div>
        <form action={forgetProfile}>
          <button className="min-h-14 text-encre-douce underline underline-offset-4">Ce n&apos;est pas moi</button>
        </form>
      </section>

      <NotificationsCard variant="full" />

      {family && <CodeFamille code={family.join_code} avecLiens />}
      {/* Un réglage fin, utile seulement à plusieurs. */}
      {family && members.length > 1 && <StrictToggle strict={family.strict_dislikes} />}

      <ul className="kd-liste border-t-2 border-trait">
        {liens.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="kd-liste__article min-h-16 justify-between active:bg-trait/40">
              <span className="min-w-0">
                <span className="block font-semibold">{l.label}</span>
                <span className="kd-petit block truncate">{l.detail}</span>
              </span>
              <IconeRetour className="size-6 shrink-0 rotate-180 text-violet" />
            </Link>
          </li>
        ))}
      </ul>

      <section className="flex flex-col gap-1">
        <h2 className="kd-etiquette">Vos données</h2>
        <p className="kd-petit mb-1">Elles restent dans la famille : pas de publicité, rien n&apos;est revendu.</p>
        <ul className="kd-liste border-t-2 border-trait">
          <li>
            <a href="/api/export" download className="kd-liste__article min-h-16 justify-between active:bg-trait/40">
              <span className="min-w-0">
                <span className="block font-semibold">Exporter les données de la famille</span>
                <span className="kd-petit block">Un fichier avec membres, goûts, recettes et courses</span>
              </span>
              <IconeRetour className="size-6 shrink-0 -rotate-90 text-violet" />
            </a>
          </li>
          <li>
            <Link href="/confidentialite" className="kd-liste__article min-h-16 justify-between active:bg-trait/40">
              <span className="block font-semibold">Confidentialité</span>
              <IconeRetour className="size-6 shrink-0 rotate-180 text-violet" />
            </Link>
          </li>
        </ul>
      </section>

      <div className="flex flex-col items-center gap-2 text-center">
        <QuitterFamille
          question={`Quitter ${family?.name ?? "cette famille"} ?`}
          detail={family ? `Pour revenir sur ce téléphone, il faudra le code : ${family.join_code}` : undefined}
          confirmLabel="Oui, quitter"
          className="min-h-14 px-2 text-encre-douce underline underline-offset-4"
        >
          Quitter cette famille sur ce téléphone
        </QuitterFamille>
        <ConfirmButton
          action={deleteFamily}
          question={`Supprimer ${family?.name ?? "la famille"} ?`}
          detail="Membres, goûts, recettes et courses sont effacés pour toute la famille, sur tous les téléphones. C'est définitif : exporte d'abord si tu veux garder une copie."
          confirmLabel="Oui, tout supprimer"
          className="min-h-14 px-2 text-encre-douce underline underline-offset-4"
        >
          Supprimer la famille et ses données
        </ConfirmButton>
      </div>
    </main>
  );
}
