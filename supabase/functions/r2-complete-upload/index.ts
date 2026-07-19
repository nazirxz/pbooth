import { corsHeaders, jsonResponse, readJson } from "../_shared/http.ts";
import {
  assetKey,
  expiryFor,
  getAuthorizedSession,
  hasPaidPayment,
  headObject,
  loadR2,
  parseAssetInput,
  serviceClient,
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

    const key = assetKey(
      input.kind,
      input.sessionId,
      input.frameIndex,
      input.ext,
    );
    const head = await headObject(r2, key);
    if (Number(head.ContentLength) !== input.sizeBytes) {
      return jsonResponse({ error: "uploaded_size_mismatch" }, 409);
    }
    if (head.ContentType && head.ContentType !== input.contentType) {
      return jsonResponse({ error: "uploaded_content_type_mismatch" }, 409);
    }

    const expiresAt = expiryFor(input.kind);
    if (input.kind === "frame") {
      const { error } = await sb.from("photos").upsert({
        session_id: input.sessionId,
        frame_index: input.frameIndex,
        storage_path: key,
        storage_backend: "r2",
        size_bytes: input.sizeBytes,
        expires_at: expiresAt,
        expired_at: null,
      }, { onConflict: "session_id,frame_index" });
      if (error) throw error;
    } else if (input.kind === "composed") {
      const { error } = await sb.from("sessions").update({
        final_storage_backend: "r2",
        final_storage_path: key,
        final_expires_at: expiresAt,
        final_image_url: null,
        status: "completed",
        completed_at: new Date().toISOString(),
        assets_expired_at: null,
      }).eq("id", input.sessionId);
      if (error) throw error;
    } else {
      const { error } = await sb.from("sessions").update({
        live_storage_backend: "r2",
        live_storage_path: key,
        live_expires_at: expiresAt,
        live_video_url: null,
        assets_expired_at: null,
      }).eq("id", input.sessionId);
      if (error) throw error;
    }

    return jsonResponse({ success: true, backend: "r2", key, expiresAt });
  } catch (error) {
    const metadata = error && typeof error === "object" && "$metadata" in error
      ? (error.$metadata as { httpStatusCode?: number })
      : null;
    const status = metadata?.httpStatusCode === 404 ? 404 : 500;
    console.error("[r2-complete-upload]", error);
    return jsonResponse({
      error: status === 404
        ? "uploaded_object_not_found"
        : "upload_completion_failed",
    }, status);
  }
});
