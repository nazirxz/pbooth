// Shared DOKU non-SNAP signature helpers + types.
// Runs on Deno (Supabase Edge Functions). Uses Web Crypto / standard
// Deno APIs — no npm deps.
//
// Reference: https://developers.doku.com/getting-started-with-doku-api/signature-component/non-snap

const enc = new TextEncoder();

function toBase64(bytes: ArrayBuffer | Uint8Array): string {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = "";
  for (let i = 0; i < u8.byteLength; i++) bin += String.fromCharCode(u8[i]);
  return btoa(bin);
}

/** Base64( SHA-256( utf8(body) ) ). DOKU calls this the "Digest". */
export async function sha256Base64(body: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", enc.encode(body));
  return toBase64(hash);
}

/** Base64( HMAC-SHA256( secret, component ) ). */
export async function hmacSha256Base64(
  secret: string,
  component: string,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(component));
  return toBase64(sig);
}

export interface SignatureInput {
  clientId: string;
  requestId: string;
  /** ISO-8601 UTC, format `YYYY-MM-DDTHH:mm:ssZ` (no millis). */
  requestTimestamp: string;
  /** Path only, e.g. `/checkout/v1/payment`. Must start with `/`. */
  requestTarget: string;
  /** Raw JSON body string used to compute the digest. Empty string for GETs. */
  body: string;
}

/**
 * Compute the DOKU non-SNAP signature header value (`HMACSHA256=<base64>`).
 *
 * Component layout (each line separated by `\n`):
 *   Client-Id:<id>
 *   Request-Id:<uuid>
 *   Request-Timestamp:<ts>
 *   Request-Target:<path>
 *   Digest:<base64-sha256-of-body>     (omitted when body is empty)
 */
export async function buildDokuSignature(
  input: SignatureInput,
  secretKey: string,
): Promise<{ signature: string; digest: string | null }> {
  const lines = [
    `Client-Id:${input.clientId}`,
    `Request-Id:${input.requestId}`,
    `Request-Timestamp:${input.requestTimestamp}`,
    `Request-Target:${input.requestTarget}`,
  ];
  let digest: string | null = null;
  if (input.body && input.body.length > 0) {
    digest = await sha256Base64(input.body);
    lines.push(`Digest:${digest}`);
  }
  const component = lines.join("\n");
  const mac = await hmacSha256Base64(secretKey, component);
  return { signature: `HMACSHA256=${mac}`, digest };
}

/** Verify an inbound DOKU signature header. Constant-time compare. */
export async function verifyDokuSignature(
  input: SignatureInput,
  secretKey: string,
  receivedSignature: string,
): Promise<boolean> {
  const { signature } = await buildDokuSignature(input, secretKey);
  return timingSafeEqual(signature, receivedSignature);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

/** ISO-8601 UTC trimmed to seconds, as DOKU expects. */
export function dokuTimestamp(d = new Date()): string {
  return d.toISOString().slice(0, 19) + "Z";
}

export function uuidV4(): string {
  return crypto.randomUUID();
}

// ────────────────────────────────────────────────────────────────────────────
// Env resolution — pick credentials based on DOKU_ENV.
//
// Lookup order:
//   1. DOKU_<ENV>_<NAME>     prefixed (preferred — lets sandbox + prod
//                            credentials live side-by-side)
//   2. DOKU_<NAME>           generic (back-compat with the original
//                            single-set deployment)
//
// `DOKU_ENV` defaults to `sandbox`. Setting it to `production` flips
// every read at once.
// ────────────────────────────────────────────────────────────────────────────

export type DokuEnv = "sandbox" | "production";

export function resolveDokuEnv(): DokuEnv {
  const v = (Deno.env.get("DOKU_ENV") ?? "sandbox").toLowerCase();
  return v === "production" ? "production" : "sandbox";
}

export function defaultBaseUrlFor(env: DokuEnv): string {
  return env === "production"
    ? "https://api.doku.com"
    : "https://api-sandbox.doku.com";
}

/**
 * Read a DOKU secret with `DOKU_<ENV>_<NAME>` taking precedence over the
 * generic `DOKU_<NAME>`. Trims whitespace so secrets pasted with stray
 * newlines don't silently break signature checks.
 */
export function dokuSecret(env: DokuEnv, name: string): string | null {
  const upper = env.toUpperCase();
  const prefixed = Deno.env.get(`DOKU_${upper}_${name}`);
  if (prefixed && prefixed.trim().length > 0) return prefixed.trim();
  const generic = Deno.env.get(`DOKU_${name}`);
  if (generic && generic.trim().length > 0) return generic.trim();
  return null;
}

export interface DokuRuntime {
  env: DokuEnv;
  baseUrl: string;
  clientId: string;
  secretKey: string;
}

/**
 * Resolve the active DOKU runtime config from env. Throws (via the
 * `null` field) when required credentials are missing — caller decides
 * how to surface the error.
 */
export function loadDokuRuntime(): DokuRuntime | null {
  const env = resolveDokuEnv();
  const clientId = dokuSecret(env, "CLIENT_ID");
  const secretKey = dokuSecret(env, "SECRET_KEY");
  if (!clientId || !secretKey) return null;
  const baseUrl = Deno.env.get("DOKU_BASE_URL") ?? defaultBaseUrlFor(env);
  return { env, baseUrl, clientId, secretKey };
}

// ────────────────────────────────────────────────────────────────────────────
// CORS — kiosk runs from `file://` (Electron) and from a vite dev server.
// Echo the Origin to keep both happy without listing each one explicitly.
// ────────────────────────────────────────────────────────────────────────────
export function corsHeaders(req: Request): HeadersInit {
  const origin = req.headers.get("Origin") ?? "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

export function jsonResponse(
  body: unknown,
  init: ResponseInit & { req?: Request } = {},
): Response {
  const { req, headers, ...rest } = init;
  return new Response(JSON.stringify(body), {
    ...rest,
    headers: {
      "content-type": "application/json",
      ...(req ? corsHeaders(req) : {}),
      ...headers,
    },
  });
}
