import "server-only";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { broadcastRefresh } from "@/lib/supabase/server";

/**
 * Après chaque écriture : rafraîchit les pages côté serveur et prévient les
 * autres téléphones (en arrière-plan, sans ralentir la réponse).
 */
export function changed(background?: () => Promise<unknown>) {
  revalidatePath("/", "layout");
  after(async () => {
    await Promise.allSettled([broadcastRefresh(), background?.()]);
  });
}

export function cleanText(value: FormDataEntryValue | null | undefined, max = 500): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
