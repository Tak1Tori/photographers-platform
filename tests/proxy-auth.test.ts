import assert from "node:assert/strict";
import { before, test } from "node:test";
import { encode } from "next-auth/jwt";
import { NextRequest } from "next/server";

process.env.AUTH_SECRET = "proxy-auth-test-secret";

let proxy: typeof import("../proxy").proxy;
let usesSecureAuthCookies: typeof import("../proxy").usesSecureAuthCookies;

before(async () => {
  ({ proxy, usesSecureAuthCookies } = await import("../proxy"));
});

const authSecret = process.env.AUTH_SECRET;

async function requestWithSession(options: {
  url: string;
  role: "ADMIN" | "CLIENT" | "PHOTOGRAPHER" | "STUDIO_OWNER";
  secureCookie: boolean;
}) {
  const cookieName = options.secureCookie
    ? "__Secure-authjs.session-token"
    : "authjs.session-token";
  const token = await encode({
    secret: authSecret!,
    salt: cookieName,
    token: { id: "test-user", role: options.role }
  });

  return new NextRequest(options.url, {
    headers: { cookie: `${cookieName}=${token}` }
  });
}

test("unauthenticated dashboard request redirects to sign-in", async () => {
  const response = await proxy(new NextRequest("http://localhost:3000/dashboard/client"));

  assert.equal(response.status, 307);
  assert.match(response.headers.get("location") ?? "", /\/auth\/sign-in\?callbackUrl=/);
});

test("production-style secure cookie authorizes a client dashboard request", async () => {
  const request = await requestWithSession({
    url: "https://framelyphoto.com/dashboard/client",
    role: "CLIENT",
    secureCookie: true
  });

  assert.equal(usesSecureAuthCookies(request), true);
  assert.equal((await proxy(request)).status, 200);
});

test("development non-secure cookie authorizes a client dashboard request", async () => {
  const request = await requestWithSession({
    url: "http://localhost:3000/dashboard/client",
    role: "CLIENT",
    secureCookie: false
  });

  assert.equal(usesSecureAuthCookies(request), false);
  assert.equal((await proxy(request)).status, 200);
});

test("photographer can access the photographer dashboard", async () => {
  const request = await requestWithSession({
    url: "https://framelyphoto.com/dashboard/photographer",
    role: "PHOTOGRAPHER",
    secureCookie: true
  });

  assert.equal((await proxy(request)).status, 200);
});

test("wrong role is redirected to unauthorized", async () => {
  const request = await requestWithSession({
    url: "https://framelyphoto.com/dashboard/photographer",
    role: "CLIENT",
    secureCookie: true
  });
  const response = await proxy(request);

  assert.equal(response.status, 307);
  assert.equal(new URL(response.headers.get("location") ?? "").pathname, "/unauthorized");
});
