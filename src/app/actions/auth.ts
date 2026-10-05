"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { serverEnv } from "@/lib/env";
import { getProfile } from "@/lib/data";
import { getSession } from "@/lib/auth";
import { SESSION_COOKIE, cookieOptions, encodeSession, safeCompare } from "@/lib/session";

function normalizeCode(code: string) {
  return code.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export async function enterFamilyCode(_prev: { error?: string }, formData: FormData): Promise<{ error?: string }> {
  const code = String(formData.get("code") ?? "");
  const ok = await safeCompare(normalizeCode(code), normalizeCode(serverEnv.familyCode));
  if (!ok) {
    // Ralentit les essais au hasard.
    await new Promise((r) => setTimeout(r, 1000));
    return { error: "Ce n'est pas le bon code. Réessayez." };
  }
  const store = await cookies();
  const token = await encodeSession({ family: true, profileId: null, role: null, iat: Math.floor(Date.now() / 1000) });
  store.set(SESSION_COOKIE, token, cookieOptions);
  redirect("/profil");
}

export async function chooseProfile(profileId: string) {
  const session = await getSession();
  if (!session) redirect("/bienvenue");
  const profile = await getProfile(profileId);
  if (!profile) throw new Error("Profil introuvable");
  const store = await cookies();
  const token = await encodeSession({
    family: true,
    profileId: profile.id,
    role: profile.role,
    iat: Math.floor(Date.now() / 1000),
  });
  store.set(SESSION_COOKIE, token, cookieOptions);
  redirect(profile.role === "parent" ? "/maman" : "/enfant");
}

export async function forgetProfile() {
  const session = await getSession();
  if (!session) redirect("/bienvenue");
  const store = await cookies();
  store.set(
    SESSION_COOKIE,
    await encodeSession({ family: true, profileId: null, role: null, iat: Math.floor(Date.now() / 1000) }),
    cookieOptions,
  );
  redirect("/profil");
}
