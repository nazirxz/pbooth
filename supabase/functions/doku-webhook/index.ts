// POST /functions/v1/doku-webhook
//
// Inbound HTTP notification from DOKU after a Checkout transaction
// reaches a final state. We:
//   1. Verify the HMAC signature using our Secret Key
//   2. Map DOKU transaction status -> PaymentStatus
//   3. Update the matching payments row by invoice_number
//
// Register THIS function's full URL with DOKU Integration Team
// (or in the back office if self-service is available):
//   https://<project-ref>.supabase.co/functions/v1/doku-webhook
//
// IMPORTANT: this endpoint is hit by DOKU's servers, not the kiosk.
// Supabase Edge Functions require a JWT by default; we mark this
// function `verify_jwt = false` in supabase/config.toml so DOKU can
// reach it without an auth header. Signature verification is the
// trust boundary instead.

// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";
import {
  buildDokuSignature,
  corsHeaders,
  jsonResponse,
  loadDokuRuntime,
} from "../_shared/doku.ts";

type PaymentStatus =
  | "idle"
  | "pending"
  | "paid"
  | "expired"
  | "failed"
  | "cancelled";

/**
 * DOKU notification payload (Checkout). Fields kept loose because DOKU
 * tweaks the schema across product lines; we only depend on the few we
 * actually need (invoice + transaction status).
 */
interface DokuNotificationBody {
  order?: {
    invoice_number?: string;
    amount?: number;
  };
  transaction?: {
    status?: string;
    date?: string;
    original_request_id?: string;
  };
  service?: { id?: string };
  [k: string]: unknown;
}

function mapDokuStatus(s: string | undefined): PaymentStatus {
  switch ((s ?? "").toUpperCase()) {
    case "SUCCESS":
    case "PAID":
    case "SETTLED":
      return "paid";
    case "EXPIRED":
      return "expired";
    case "CANCELLED":
    case "CANCELED":
    case "VOIDED":
      return "cancelled";
    case "FAILED":
    case "DECLINED":
    case "REJECTED":
      return "failed";
    default:
      return "pending";
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, { status: 405, req });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const runtime = loadDokuRuntime();
  // The path DOKU signed against. Defaults to the public function URL path.
  const WEBHOOK_REQUEST_TARGET = Deno.env.get("DOKU_WEBHOOK_REQUEST_TARGET") ??
    "/functions/v1/doku-webhook";

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !runtime) {
    return jsonResponse(
      { error: "missing_env" },
      { status: 500, req },
    );
  }
  const { clientId: DOKU_CLIENT_ID, secretKey: DOKU_SECRET_KEY } = runtime;

  const clientId = req.headers.get("Client-Id") ?? "";
  const requestId = req.headers.get("Request-Id") ?? "";
  const requestTimestamp = req.headers.get("Request-Timestamp") ?? "";
  const receivedSig = req.headers.get("Signature") ?? "";
  const rawBody = await req.text();

  if (!clientId || !requestId || !requestTimestamp || !receivedSig) {
    return jsonResponse(
      { error: "missing_signature_headers" },
      { status: 400, req },
    );
  }
  if (clientId !== DOKU_CLIENT_ID) {
    return jsonResponse({ error: "client_id_mismatch" }, { status: 401, req });
  }

  // ── verify signature ────────────────────────────────────────────────────
  const { signature: expected } = await buildDokuSignature({
    clientId,
    requestId,
    requestTimestamp,
    requestTarget: WEBHOOK_REQUEST_TARGET,
    body: rawBody,
  }, DOKU_SECRET_KEY);

  if (expected !== receivedSig) {
    console.warn(
      "[doku-webhook] signature mismatch",
      { requestId, expectedHead: expected.slice(0, 24) },
    );
    return jsonResponse(
      { error: "invalid_signature" },
      { status: 401, req },
    );
  }

  // ── parse & route ───────────────────────────────────────────────────────
  let body: DokuNotificationBody;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return jsonResponse({ error: "invalid_json" }, { status: 400, req });
  }

  const invoice = body.order?.invoice_number;
  if (!invoice) {
    return jsonResponse(
      { error: "missing_invoice_number" },
      { status: 400, req },
    );
  }

  const newStatus = mapDokuStatus(body.transaction?.status);

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const patch: Record<string, any> = {
    status: newStatus,
    provider_payload: body,
  };
  if (newStatus === "paid") {
    patch.paid_at = body.transaction?.date ?? new Date().toISOString();
  }

  const { data, error } = await sb
    .from("payments")
    .update(patch)
    .eq("invoice_number", invoice)
    .select("id, session_id, status")
    .maybeSingle();

  if (error) {
    console.error("[doku-webhook] db update failed:", error.message);
    return jsonResponse(
      { error: "db_update_failed", detail: error.message },
      { status: 500, req },
    );
  }
  if (!data) {
    // Acknowledge with 200 so DOKU doesn't keep retrying for an
    // invoice we don't know about, but log it for investigation.
    console.warn("[doku-webhook] no matching payment for invoice", invoice);
    return jsonResponse({ ok: true, matched: false }, { status: 200, req });
  }

  // Cascade session status when payment succeeds.
  if (newStatus === "paid" && data.session_id) {
    await sb.from("sessions").update({ status: "paid" }).eq(
      "id",
      data.session_id,
    );
  }

  return jsonResponse(
    { ok: true, paymentId: data.id, status: newStatus },
    { status: 200, req },
  );
});
