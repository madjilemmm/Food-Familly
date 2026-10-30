import Link from "next/link";
import { EtatVide } from "@/components/ui";

export const metadata = { title: "Introuvable — Kaddie" };

/**
 * Une adresse inconnue, ou une recette supprimée depuis : un message Kaddie et le chemin du retour,
 * jamais la page grise « 404 This page could not be found. » en anglais.
 */
export default function Introuvable() {
  return (
    <main className="pt-safe pb-safe mx-auto max-w-xl px-5">
      <h1 className="kd-titre-1 mt-6 mb-5 text-aubergine">Introuvable</h1>
      <EtatVide phrase="Cette page n'existe pas, ou plus : la recette a peut-être été supprimée.">
        <Link href="/menu" className="kd-btn kd-btn--large">
          Retour à Ce soir
        </Link>
      </EtatVide>
    </main>
  );
}
