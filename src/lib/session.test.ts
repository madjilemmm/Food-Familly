import { beforeEach, describe, expect, it } from "vitest";
import { decodeSession, encodeSession, safeCompare, type Session } from "./session";

const session: Session = { family: true, profileId: "abc", role: "child", iat: 1 };

describe("session", () => {
  beforeEach(() => {
    process.env.SESSION_SECRET = "secret-de-test";
    process.env.FAMILY_CODE = "poulet";
  });

  it("encode puis décode la session", async () => {
    expect(await decodeSession(await encodeSession(session))).toEqual(session);
  });

  it("refuse une session modifiée", async () => {
    const token = await encodeSession(session);
    const [, sig] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ ...session, role: "parent" })).toString("base64url");
    expect(await decodeSession(`${forged}.${sig}`)).toBeNull();
  });

  it("invalide les sessions quand le code famille change", async () => {
    const token = await encodeSession(session);
    process.env.FAMILY_CODE = "nouveau-code";
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
