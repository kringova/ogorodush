import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "ogorod_session";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days in seconds
const SALT = "ogorod-dashboard-v1";

/**
 * Derive a session token from the password using HMAC-SHA-256 (Web Crypto API).
 * Returns a hex string. Edge-runtime compatible — uses crypto.subtle only.
 */
async function deriveToken(password: string): Promise<string> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", keyMaterial, enc.encode(SALT));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Constant-time comparison to prevent timing attacks.
 * Both strings should be hex tokens of equal length.
 */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * v2-защита: HTTP Basic Auth + persistent session cookie.
 *
 * После первого успешного Basic-auth в ответ устанавливается httpOnly-cookie
 * (ogorod_session) — токен = HMAC-SHA-256(password, staticSalt). На следующих
 * запросах middleware принимает либо cookie, либо Basic-заголовок.
 * Это решает проблему мобильных браузеров (iOS Safari), которые агрессивно
 * сбрасывают Basic-credentials из памяти таба.
 *
 * Без DASHBOARD_PASSWORD (localhost) — доступ открыт, как и прежде.
 */
export async function middleware(req: NextRequest) {
  const password = process.env.DASHBOARD_PASSWORD;
  if (!password) return NextResponse.next();

  const expectedToken = await deriveToken(password);

  // 1. Check session cookie first (fast path for returning visitors)
  const cookieToken = req.cookies.get(COOKIE_NAME)?.value;
  if (cookieToken && safeEqual(cookieToken, expectedToken)) {
    return NextResponse.next();
  }

  // 2. Check Basic Auth header
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Basic ")) {
    const decoded = atob(auth.slice(6));
    const pass = decoded.slice(decoded.indexOf(":") + 1);
    if (pass === password) {
      // Successful Basic Auth — set session cookie so future requests skip Basic-auth
      const res = NextResponse.next();
      res.cookies.set(COOKIE_NAME, expectedToken, {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        maxAge: COOKIE_MAX_AGE,
        path: "/",
      });
      return res;
    }
  }

  return new NextResponse("Требуется авторизация", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="ogorod"' },
  });
}

export const config = {
  // всё, кроме статики и внутренних путей Next
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
