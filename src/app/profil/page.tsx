import { getProfiles } from "@/lib/data";
import { chooseProfile } from "@/app/actions/auth";

export const metadata = { title: "Qui es-tu ? — À table !" };
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const profiles = await getProfiles();
  return (
    <main className="pt-safe pb-safe mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6">
      <h1 className="mb-8 text-center text-4xl font-extrabold">Qui es-tu ?</h1>
      <ul className="space-y-4">
        {profiles.map((p) => (
          <li key={p.id}>
            <form action={chooseProfile.bind(null, p.id)}>
              <button
                type="submit"
                className={`flex w-full items-center gap-5 rounded-3xl px-6 py-5 text-left shadow-md active:scale-[0.98] ${
                  p.role === "parent" ? "bg-tomato-500 text-white" : "bg-white"
                }`}
              >
                <span className="text-5xl">{p.emoji}</span>
                <span className="text-3xl font-bold">{p.name}</span>
              </button>
            </form>
          </li>
        ))}
      </ul>
      <p className="mt-8 text-center text-stone-500">Ton choix est retenu sur ce téléphone.</p>
    </main>
  );
}
