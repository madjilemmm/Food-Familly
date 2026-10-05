import { redirect } from "next/navigation";

// Le middleware redirige déjà selon le profil ; ceci est un filet de sécurité.
export default function Home() {
  redirect("/bienvenue");
}
