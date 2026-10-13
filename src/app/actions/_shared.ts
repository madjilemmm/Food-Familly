import "server-only";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { broadcastRefresh } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";

/**
 * Après chaque écriture : rafraîchit les pages côté serveur et prévient les
 * autres téléphones de la famille (en arrière-plan, sans ralentir la réponse).
 */
export function changed(background?: () => Promise<unknown>) {
  revalidatePath("/", "layout");
  after(async () => {
    const session = await getSession().catch(() => null);
    await Promise.allSettled([session ? broadcastRefresh(session.familyId) : Promise.resolve(), background?.()]);
  });
}

export function cleanText(value: FormDataEntryValue | null | undefined, max = 500): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
