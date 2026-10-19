import "server-only";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { broadcastRefresh } from "@/lib/supabase/server";
import { APPAREIL_COOKIE } from "@/lib/appareil";
import { getSession } from "@/lib/auth";

/**
 * Après chaque écriture : rafraîchit les pages côté serveur et prévient les
 * autres téléphones de la famille (en arrière-plan, sans ralentir la réponse).
 */
export function changed(background?: () => Promise<unknown>) {
  revalidatePath("/", "layout");
  after(async () => {
    const session = await getSession().catch(() => null);
    // Le téléphone qui agit a déjà l'écran à jour (réponse de l'action) : le signal lui dit de l'ignorer.
    const appareil = (await cookies().catch(() => null))?.get(APPAREIL_COOKIE)?.value;
    await Promise.allSettled([session ? broadcastRefresh(session.familyId, appareil) : Promise.resolve(), background?.()]);
  });
}

export function cleanText(value: FormDataEntryValue | null | undefined, max = 500): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
