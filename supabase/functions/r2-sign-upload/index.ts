import { corsHeaders, jsonResponse, readJson } from "../_shared/http.ts";
import {
  assetKey,
  getAuthorizedSession,
  hasPaidPayment,
  loadR2,
  parseAssetInput,
  serviceClient,
  signPut,
  UPLOAD_URL_TTL_SECONDS,
} from "../_shared/r2.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(req) });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  try {
    const sb = serviceClient();
    const r2 = loadR2();
    if (!sb || !r2) {
      return jsonResponse({ error: "server_storage_not_configured" }, 500);
    }

    const body = await readJson<Record<string, unknown>>(req);
    if (!body) return jsonResponse({ error: "invalid_json" }, 400);
    const parsed = parseAssetInput(body);
    if (!parsed.input) return jsonResponse({ error: parsed.error }, 400);
    const input = parsed.input;

    const authorized = await getAuthorizedSession(
      sb,
      input.sessionId,
      input.shareToken,
    );
    if (!authorized.row) return jsonResponse({ error: authorized.error }, 403);
    if (!(await hasPaidPayment(sb, authorized.row))) {
      return jsonResponse({ error: "payment_not_paid" }, 403);
    }
    if (
      !["paid", "capturing", "completed"].includes(
        String(authorized.row.status),
      )
    ) {
      return jsonResponse({ error: "session_not_uploadable" }, 409);
    }

    const key = assetKey(
      input.kind,
      input.sessionId,
      input.frameIndex,
      input.ext,
    );
    const uploadUrl = await signPut(
      r2,
      key,
      input.contentType,
      input.sizeBytes,
    );
    return jsonResponse({
      backend: "r2",
      key,
      uploadUrl,
      headers: { "Content-Type": input.contentType },
      expiresIn: UPLOAD_URL_TTL_SECONDS,
    });
  } catch (error) {
    console.error("[r2-sign-upload]", error);
    return jsonResponse({ error: "upload_signing_failed" }, 500);
  }
});
