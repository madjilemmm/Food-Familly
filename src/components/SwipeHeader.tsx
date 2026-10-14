import { Logo } from "@/design-system/components/Kaddie";
import { LienReglages } from "@/components/ui";
import { NotificationsCard } from "@/components/pwa/NotificationsCard";

/** En-tête du swipe : monogramme, pastille des matchs, notifs, réglages. */
export function SwipeHeader({ matchs }: { matchs: number }) {
  return (
    <header className="flex items-center gap-3 pt-2">
      <Logo variante="monogramme" width={34} />
      {matchs > 0 && (
        <span className="kd-pastille kd-pastille--match">
          {matchs} match{matchs > 1 ? "s" : ""}
        </span>
      )}
      <span className="ml-auto flex gap-2">
        <NotificationsCard variant="icone" />
        <LienReglages surScene />
      </span>
    </header>
  );
}
