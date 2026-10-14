import { Logo } from "@/design-system/components/Kaddie";

/** Attente dans un bouton : le monogramme qui pulse, dans la couleur du texte. */
export function Spinner({ className = "w-6" }: { className?: string }) {
  return (
    <span role="status" aria-label="Chargement" className={`kd-pulse inline-block align-middle ${className}`}>
      <Logo variante="monogramme" width="100%" title="" />
    </span>
  );
}
