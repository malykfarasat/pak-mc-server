/**
 * Google OAuth 2.0 + signed-cookie session for PAK MC SERVER admin panel.
 *
 * Flow:
 *   1. GET /login          → redirect to Google consent screen with state CSRF
 *   2. GET /auth/callback  → exchange code for tokens, verify ID token,
 *                            sign a session cookie with HMAC-SHA256
 *   3. Every request       → requireSession() verifies the HMAC signature
 *                            and rejects expired/tampered sessions
 */

const SESSION_COOKIE = "pak_mc_session";
const STATE_COOKIE = "pak_mc_oauth_state";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

// ─────────────────────────────────────────────────────────────────────────────
// Login — redirect user to Google
// ─────────────────────────────────────────────────────────────────────────────
export async function handleLogin(request, env) {
  const url = new URL(request.url);
  const redirectUri = `${url.origin}/auth/callback`;
  const state = crypto.randomUUID();

  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", env.GOOGLE_CLIENT_ID);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", "openid email profile");
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("access_type", "online");
  authUrl.searchParams.set("prompt", "select_account");

  return new Response(null, {
    status: 302,
    headers: {
      Location: authUrl.toString(),
      "Set-Cookie": cookie(STATE_COOKIE, state, { maxAge: 600, httpOnly: true, secure: true, sameSite: "Lax" }),
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Callback — exchange code for tokens, validate, set session
// ─────────────────────────────────────────────────────────────────────────────
export async function handleCallback(request, env) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    return new Response(`OAuth error: ${error}`, { status: 400 });
  }
  if (!code || !state) {
    return new Response("Missing code or state", { status: 400 });
  }

  // Verify state matches cookie (CSRF protection)
  const cookies = parseCookies(request.headers.get("Cookie") || "");
  if (cookies[STATE_COOKIE] !== state) {
    return new Response("Invalid state", { status: 400 });
  }

  // Exchange authorization code for tokens
  const redirectUri = `${url.origin}/auth/callback`;
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) {
    const t = await tokenRes.text();
    return new Response(`Token exchange failed: ${t}`, { status: 500 });
  }

  const tokens = await tokenRes.json();
  const idToken = tokens.id_token;
  if (!idToken) {
    return new Response("No id_token returned", { status: 500 });
  }

  // Decode ID token (we trust Google's HTTPS endpoint; a full JWKS
  // verification would be more robust but is unnecessary here because
  // we fetched the token directly from Google over TLS with our secret).
  const claims = decodeJwtPayload(idToken);
  if (!claims || !claims.email) {
    return new Response("Invalid id_token", { status: 500 });
  }
  if (claims.email_verified !== true) {
    return new Response("Email not verified by Google", { status: 403 });
  }

  // Build our own signed session cookie
  const session = {
    email: claims.email,
    name: claims.name || claims.email,
    picture: claims.picture || null,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE,
  };

  const signed = await signSession(session, env.SESSION_SECRET);

  const headers = new Headers({ Location: "/" });
  headers.append(
    "Set-Cookie",
    cookie(SESSION_COOKIE, signed, {
      maxAge: SESSION_MAX_AGE,
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
    })
  );
  headers.append(
    "Set-Cookie",
    cookie(STATE_COOKIE, "", {
      maxAge: 0,
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
    })
  );

  return new Response(null, {
    status: 302,
    headers,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Logout
// ─────────────────────────────────────────────────────────────────────────────
export function handleLogout(request, env) {
  return new Response(null, {
    status: 302,
    headers: {
      Location: "/login",
      "Set-Cookie": cookie(SESSION_COOKIE, "", { maxAge: 0, httpOnly: true, secure: true, sameSite: "Lax" }),
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Session verification
// ─────────────────────────────────────────────────────────────────────────────
export async function requireSession(request, env) {
  const cookies = parseCookies(request.headers.get("Cookie") || "");
  const signed = cookies[SESSION_COOKIE];
  if (!signed) return null;

  try {
    const session = await verifySession(signed, env.SESSION_SECRET);
    if (!session) return null;
    if (session.exp < Math.floor(Date.now() / 1000)) return null;
    return session;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Crypto helpers — HMAC-SHA256 signed session cookies
// ─────────────────────────────────────────────────────────────────────────────
async function signSession(payload, secret) {
  const encoder = new TextEncoder();
  const json = JSON.stringify(payload);
  const body = base64urlEncode(encoder.encode(json));

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sigBuf = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  const sig = base64urlEncode(new Uint8Array(sigBuf));
  return `${body}.${sig}`;
}

async function verifySession(signed, secret) {
  const [body, sig] = signed.split(".");
  if (!body || !sig) return null;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    base64urlDecode(sig),
    encoder.encode(body)
  );
  if (!valid) return null;

  const json = new TextDecoder().decode(base64urlDecode(body));
  return JSON.parse(json);
}

function decodeJwtPayload(jwt) {
  try {
    const parts = jwt.split(".");
    if (parts.length !== 3) return null;
    const json = new TextDecoder().decode(base64urlDecode(parts[1]));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function base64urlEncode(bytes) {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlDecode(str) {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  const bin = atob(str);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Cookie helpers
// ─────────────────────────────────────────────────────────────────────────────
function cookie(name, value, opts = {}) {
  const parts = [`${name}=${value}`];
  if (opts.maxAge !== undefined) parts.push(`Max-Age=${opts.maxAge}`);
  if (opts.path !== undefined) parts.push(`Path=${opts.path}`);
  else parts.push("Path=/");
  if (opts.httpOnly) parts.push("HttpOnly");
  if (opts.secure) parts.push("Secure");
  if (opts.sameSite) parts.push(`SameSite=${opts.sameSite}`);
  return parts.join("; ");
}

function parseCookies(header) {
  const out = {};
  header.split(";").forEach((pair) => {
    const idx = pair.indexOf("=");
    if (idx < 0) return;
    const k = pair.slice(0, idx).trim();
    const v = pair.slice(idx + 1).trim();
    out[k] = v;
  });
  return out;
}
