import { SkeletonBandeau } from "@/components/Skeleton";

const jour = () => new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Paris" }).format(new Date());

export default function Loading() {
  return <SkeletonBandeau etiquette={jour().replace(/^./, (c) => c.toUpperCase())} titre="Ce soir" />;
}
