import { redirect } from "next/navigation";

/** « Ce soir » est en tête du Menu : les anciens liens (notifications, applis installées) y mènent. */
export default async function CeSoir({ searchParams }: { searchParams: Promise<{ i?: string }> }) {
  const { i } = await searchParams;
  redirect(i ? `/menu?i=${encodeURIComponent(i)}` : "/menu");
}
