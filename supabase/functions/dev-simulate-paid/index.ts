// POST /functions/v1/dev-simulate-paid
//
// SANDBOX-ONLY shortcut for marking a `payments` row as paid without
// going through DOKU. Used by the kiosk's "DEV: SIMULATE PAID" button.
//
// Hard safety: rejects the request unless DOKU_ENV !== 'production'.
// In production the kiosk should never offer this button anyway, but
// belt-and-suspenders.

// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";
import { corsHeaders, jsonResponse } from "../_shared/doku.ts";

interface Body {
  paymentId: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, { status: 405, req });
  }

  // ── safety: never allow this in production ──────────────────────────────
  const DOKU_ENV = (Deno.env.get("DOKU_ENV") ?? "sandbox").toLowerCase();
  if (DOKU_ENV === "production") {
    return jsonResponse(
      {
        error: "disabled_in_production",
        detail:
          "dev-simulate-paid is locked when DOKU_ENV=production. Use the DOKU production back office or a real transaction instead.",
      },
      { status: 403, req },
    );
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return jsonResponse({ error: "missing_env" }, { status: 500, req });
  }

  let input: Body;
  try {
    input = await req.json();
  } catch {
    return jsonResponse({ error: "invalid_json" }, { status: 400, req });
  }
  if (!input.paymentId || typeof input.paymentId !== "string") {
    return jsonResponse({ error: "missing_paymentId" }, { status: 400, req });
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const nowIso = new Date().toISOString();

  // Read current provider_payload so we can merge a dev_simulated marker
  // without clobbering the DOKU response we already stored.
  const { data: existing, error: readErr } = await sb
    .from("payments")
    .select("id, session_id, provider_payload")
    .eq("id", input.paymentId)
    .maybeSingle();
  if (readErr) {
    return jsonResponse(
      { error: "db_read_failed", detail: readErr.message },
      { status: 500, req },
    );
  }
  if (!existing) {
    return jsonResponse(
      { error: "payment_not_found", paymentId: input.paymentId },
      { status: 404, req },
    );
  }

  const mergedPayload = {
    ...((existing.provider_payload as Record<string, unknown> | null) ?? {}),
    dev_simulated: true,
    dev_simulated_at: nowIso,
  };

  const { error } = await sb
    .from("payments")
    .update({
      status: "paid",
      paid_at: nowIso,
      provider_payload: mergedPayload,
    } as Record<string, unknown>)
    .eq("id", input.paymentId);

  if (error) {
    return jsonResponse(
      { error: "db_update_failed", detail: error.message },
      { status: 500, req },
    );
  }

  if (existing.session_id) {
    await sb.from("sessions").update({ status: "paid" }).eq(
      "id",
      existing.session_id,
    );
  }

  return jsonResponse(
    { ok: true, paymentId: existing.id, status: "paid" },
    { status: 200, req },
  );
});
