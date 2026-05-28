// POST /functions/v1/create-doku-payment
//
// Body:  { amount: number, sessionId?: string | null }
// Returns: { paymentId, invoiceNumber, paymentUrl, expiresAt }
//
// Flow:
//   1. Generate invoice_number locally
//   2. Insert payments row (status=pending) using service role
//   3. Call DOKU Checkout `/checkout/v1/payment` with HMAC signature
//   4. Update payments row with payment_url + provider_payload
//   5. Return enough info for the kiosk to render its QR
//
// The kiosk subscribes to `payments:id=eq.<paymentId>` via Supabase Realtime
// to learn when the doku-webhook flips status to `paid`.

// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";
import {
  buildDokuSignature,
  corsHeaders,
  dokuTimestamp,
  jsonResponse,
  loadDokuRuntime,
  uuidV4,
} from "../_shared/doku.ts";

const REQUEST_TARGET = "/checkout/v1/payment";

interface CreatePaymentRequest {
  amount: number;
  sessionId?: string | null;
  /** Optional override — defaults to env DOKU_DEFAULT_PAYMENT_DUE_MIN. */
  paymentDueMinutes?: number;
  /** Optional restriction. Default: empty (DOKU shows the full picker). */
  paymentMethodTypes?: string[];
  customer?: {
    name?: string;
    email?: string;
    phone?: string;
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, { status: 405, req });
  }

  // ── env ─────────────────────────────────────────────────────────────────
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const runtime = loadDokuRuntime();
  const DEFAULT_DUE_MIN = parseInt(
    Deno.env.get("DOKU_DEFAULT_PAYMENT_DUE_MIN") ?? "60",
    10,
  );
  const CALLBACK_URL = Deno.env.get("DOKU_CALLBACK_URL") ?? "";

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !runtime) {
    return jsonResponse(
      {
        error: "missing_env",
        detail:
          "DOKU credentials not set for the active DOKU_ENV. " +
          "Use `supabase secrets set DOKU_<ENV>_CLIENT_ID=... DOKU_<ENV>_SECRET_KEY=...`.",
      },
      { status: 500, req },
    );
  }

  const { env: DOKU_ENV, baseUrl: DOKU_BASE_URL, clientId: DOKU_CLIENT_ID,
    secretKey: DOKU_SECRET_KEY } = runtime;

  // ── input ───────────────────────────────────────────────────────────────
  let input: CreatePaymentRequest;
  try {
    input = await req.json();
  } catch {
    return jsonResponse({ error: "invalid_json" }, { status: 400, req });
  }
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return jsonResponse(
      { error: "invalid_amount" },
      { status: 400, req },
    );
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const invoiceNumber = `PBOOTH-${Date.now()}-${
    Math.random().toString(36).slice(2, 8).toUpperCase()
  }`;
  const dueMinutes = input.paymentDueMinutes ?? DEFAULT_DUE_MIN;
  const expiresAt = new Date(Date.now() + dueMinutes * 60_000);

  // ── 1. insert pending payment row ───────────────────────────────────────
  const { data: paymentRow, error: insertErr } = await sb
    .from("payments")
    .insert({
      session_id: input.sessionId ?? null,
      provider: "doku",
      provider_ref: invoiceNumber,
      invoice_number: invoiceNumber,
      amount: input.amount,
      status: "pending",
      qr_string: null,
      expires_at: expiresAt.toISOString(),
    })
    .select("*")
    .single();

  if (insertErr || !paymentRow) {
    return jsonResponse(
      { error: "db_insert_failed", detail: insertErr?.message },
      { status: 500, req },
    );
  }

  // ── 2. call DOKU Checkout ──────────────────────────────────────────────
  const requestId = uuidV4();
  const requestTimestamp = dokuTimestamp();

  // Defaults: don't restrict method types — DOKU will render the full
  // picker (QRIS, VA, e-wallet, etc.) on the hosted page, which is more
  // reliable in sandbox where individual sub-channels can be disabled.
  // The kiosk can override via the `paymentMethodTypes` field.
  const methodTypes = input.paymentMethodTypes;
  const paymentBlock: Record<string, unknown> = {
    payment_due_date: dueMinutes,
  };
  if (methodTypes && methodTypes.length > 0) {
    paymentBlock.payment_method_types = methodTypes;
  }

  // DOKU requires a `customer` block for some downstream methods
  // (e.g. paylater) but it's harmless for QRIS. Provide kiosk-safe
  // defaults so the hosted page never errors on missing customer.
  const customer = {
    name: input.customer?.name ?? "Pbooth Kiosk Customer",
    email: input.customer?.email ?? "kiosk@pbooth.local",
    phone: input.customer?.phone ?? "+628000000000",
  };

  const requestBody = {
    order: {
      amount: input.amount,
      invoice_number: invoiceNumber,
      currency: "IDR",
      callback_url: CALLBACK_URL || undefined,
      // Helps DOKU correlate notifications back to a specific cart.
      session_id: invoiceNumber,
      line_items: [
        {
          name: "Pbooth Photo Session",
          price: input.amount,
          quantity: 1,
        },
      ],
    },
    payment: paymentBlock,
    customer,
  };
  const bodyStr = JSON.stringify(requestBody);

  const { signature } = await buildDokuSignature({
    clientId: DOKU_CLIENT_ID,
    requestId,
    requestTimestamp,
    requestTarget: REQUEST_TARGET,
    body: bodyStr,
  }, DOKU_SECRET_KEY);

  const dokuRes = await fetch(`${DOKU_BASE_URL}${REQUEST_TARGET}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Client-Id": DOKU_CLIENT_ID,
      "Request-Id": requestId,
      "Request-Timestamp": requestTimestamp,
      "Signature": signature,
    },
    body: bodyStr,
  });

  const rawText = await dokuRes.text();
  let dokuBody: any = null;
  try {
    dokuBody = JSON.parse(rawText);
  } catch {
    dokuBody = { raw: rawText };
  }

  if (!dokuRes.ok) {
    await sb.from("payments").update({
      status: "failed",
      provider_payload: { request: requestBody, response: dokuBody },
    }).eq("id", paymentRow.id);

    return jsonResponse(
      {
        error: "doku_request_failed",
        status: dokuRes.status,
        body: dokuBody,
      },
      { status: 502, req },
    );
  }

  const paymentUrl: string | null = dokuBody?.response?.payment?.url ??
    dokuBody?.payment?.url ?? null;
  const tokenId: string | null = dokuBody?.response?.payment?.token_id ??
    dokuBody?.payment?.token_id ?? null;

  // ── 3. (optional) call generate-qris to get the raw QRIS EMV string ─────
  //
  // When the kiosk asked for QRIS as the only payment method we can also
  // pre-generate the actual QR string here. That lets the kiosk render a
  // single QR that the customer scans directly with a banking/e-wallet
  // app — no second hop through the DOKU hosted page. If this call fails
  // we fall back to the hosted-page URL flow.
  let qrisString: string | null = null;
  let qrisNmid: string | null = null;
  let qrisAccessToken: string | null = null;
  let qrisSystrace: number | null = null;
  let qrisError: unknown = null;

  const wantQris = !methodTypes || methodTypes.length === 0 ||
    methodTypes.includes("QRIS");

  if (wantQris && tokenId) {
    const qrisTarget = `/checkout/v1/payment/${tokenId}/generate-qris`;
    const qrisRid = uuidV4();
    const qrisTs = dokuTimestamp();
    const qrisBody = JSON.stringify({ token_id: tokenId });

    const { signature: qrisSig } = await buildDokuSignature({
      clientId: DOKU_CLIENT_ID,
      requestId: qrisRid,
      requestTimestamp: qrisTs,
      requestTarget: qrisTarget,
      body: qrisBody,
    }, DOKU_SECRET_KEY);

    const qrisRes = await fetch(`${DOKU_BASE_URL}${qrisTarget}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Client-Id": DOKU_CLIENT_ID,
        "Request-Id": qrisRid,
        "Request-Timestamp": qrisTs,
        "Signature": qrisSig,
      },
      body: qrisBody,
    });

    const qrisRawText = await qrisRes.text();
    let qrisJson: any = null;
    try {
      qrisJson = JSON.parse(qrisRawText);
    } catch {
      qrisJson = { raw: qrisRawText };
    }

    if (qrisRes.ok && typeof qrisJson?.qr_code === "string") {
      qrisString = qrisJson.qr_code;
      qrisNmid = qrisJson.nmid ?? null;
      qrisAccessToken = qrisJson.access_token ?? null;
      qrisSystrace = typeof qrisJson.systrace === "number"
        ? qrisJson.systrace
        : null;
    } else {
      // Don't fail the whole call — fall back to URL flow with a warning.
      qrisError = {
        status: qrisRes.status,
        body: qrisJson,
      };
      console.warn(
        "[create-doku-payment] generate-qris failed, falling back to URL",
        qrisError,
      );
    }
  }

  // ── 4. update payment row with DOKU response ────────────────────────────
  // Prefer the raw QRIS EMV string for `qr_string` so the kiosk can render
  // a single, directly-scannable QR. Fall back to the hosted-page URL.
  await sb.from("payments").update({
    payment_url: paymentUrl,
    qr_string: qrisString ?? paymentUrl,
    provider_payload: {
      doku_env: DOKU_ENV,
      doku_base_url: DOKU_BASE_URL,
      request: requestBody,
      response: dokuBody,
      qris: qrisString
        ? {
          nmid: qrisNmid,
          access_token: qrisAccessToken,
          systrace: qrisSystrace,
        }
        : null,
      qris_error: qrisError,
    },
  }).eq("id", paymentRow.id);

  return jsonResponse(
    {
      paymentId: paymentRow.id,
      invoiceNumber,
      // Raw QRIS EMV string when DOKU returned one; null otherwise.
      qrString: qrisString,
      // Hosted-page URL — useful as a fallback for non-QRIS methods or
      // if the kiosk wants to deep-link a customer to DOKU's picker.
      paymentUrl,
      nmid: qrisNmid,
      expiresAt: expiresAt.toISOString(),
    },
    { status: 200, req },
  );
});
