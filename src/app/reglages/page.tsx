import Link from "next/link";
import { requireProfile, requireUser } from "@/lib/auth";
import { getFamily } from "@/lib/data";
import { deleteFamily, forgetProfile, leaveFamily } from "@/app/actions/auth";
import { NotificationsCard } from "@/components/pwa/NotificationsCard";
import { IconeRetour } from "@/components/ui";
import { ConfirmButton } from "@/components/courses/ConfirmButton";

export const metadata = { title: "Réglages — Kaddie" };

/** Des sections séparées par l'espace, pas des cartes empilées. */
export default async function SettingsPage() {
  const user = await requireUser();
  const [me, family] = await Promise.all([requireProfile(), getFamily(user.familyId)]);
  const liens = [
    { href: "/profil/portrait", label: "Ton portrait gourmand", detail: "Ce que Kaddie a compris de toi" },
    { href: "/annee", label: "Notre année à table", detail: "Le bilan de la famille, à partager" },
    { href: `/profil/gouts?suite=${encodeURIComponent("/reglages")}`, label: "Mes goûts", detail: "Allergies, envies, j'aime / j'aime pas" },
    { href: "/famille", label: "Ma famille", detail: family ? `${family.name} · code, membres, mode strict` : "Code, membres, mode strict" },
  ];
  return (
    <main className="pt-safe pb-safe mx-auto flex max-w-xl flex-col gap-10 px-5 pb-16">
      <div>
        <Link href={"/"} className="-ml-2 inline-flex min-h-14 items-center gap-1 font-semibold text-violet">
          <IconeRetour className="size-6" /> Retour
        </Link>
        <h1 className="kd-titre-1 mt-2 text-aubergine">Réglages</h1>
      </div>

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
        <ConfirmButton
          action={leaveFamily}
          question={`Quitter ${family?.name ?? "cette famille"} ?`}
          detail={family ? `Pour revenir sur ce téléphone, il faudra le code : ${family.join_code}` : undefined}
          confirmLabel="Oui, quitter"
          className="min-h-14 px-2 text-encre-douce underline underline-offset-4"
        >
          Quitter cette famille sur ce téléphone
        </ConfirmButton>
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
