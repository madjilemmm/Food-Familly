import { beforeEach, describe, expect, it } from "vitest";
import { decodeAnySession, decodeSession, encodeSession, newSession, safeCompare } from "./session";

describe("session", () => {
  beforeEach(() => {
    process.env.SESSION_SECRET = "secret-de-test";
    process.env.FAMILY_CODE = "poulet";
  });

  it("encode puis décode la session", async () => {
    const s = newSession("fam-1", "p-1", "fun");
    expect(await decodeSession(await encodeSession(s))).toEqual(s);
  });

  it("refuse une session modifiée (changer de famille)", async () => {
    const token = await encodeSession(newSession("fam-1", "p-1", "fun"));
    const [, sig] = token.split(".");
    const forged = Buffer.from(JSON.stringify(newSession("fam-2", "p-1", "fun"))).toString("base64url");
    expect(await decodeSession(`${forged}.${sig}`)).toBeNull();
  });

  it("reconnaît l'ancien format pour le convertir, sans le prendre pour une session valide", async () => {
    const legacy = await encodeSession({ family: true, profileId: "p-1", iat: 1 });
    expect(await decodeSession(legacy)).toBeNull();
    expect(await decodeAnySession(legacy)).toEqual({ family: true, profileId: "p-1", iat: 1 });
  });

  it("change de clé si le secret change", async () => {
    const token = await encodeSession(newSession("fam-1"));
    process.env.SESSION_SECRET = "autre";
    expect(await decodeSession(token)).toBeNull();
  });

  it("refuse les jetons vides ou mal formés", async () => {
    expect(await decodeSession(undefined)).toBeNull();
    expect(await decodeSession("n'importe quoi")).toBeNull();
  });

  it("compare les codes", async () => {
    expect(await safeCompare("a", "a")).toBe(true);
    expect(await safeCompare("a", "b")).toBe(false);
  });
});
