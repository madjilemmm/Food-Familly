import { FamilyCodeForm } from "./FamilyCodeForm";

export const metadata = { title: "Bienvenue — À table !" };

export default function WelcomePage() {
  return (
    <main className="pt-safe pb-safe mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6">
      <div className="mb-10 text-center">
        <div className="mb-4 text-7xl">🍽️</div>
        <h1 className="text-4xl font-extrabold tracking-tight">À table !</h1>
        <p className="mt-3 text-lg text-stone-600">Les courses et les repas de la famille, sans prise de tête.</p>
      </div>
      <FamilyCodeForm />
    </main>
  );
}
