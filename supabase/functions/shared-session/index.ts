import { corsHeaders, jsonResponse, readJson } from "../_shared/http.ts";
import {
  DOWNLOAD_URL_TTL_SECONDS,
  getAuthorizedSession,
  isUuid,
  loadR2,
  serviceClient,
  signGet,
} from "../_shared/r2.ts";

function isAvailable(expiresAt: unknown, expiredAt?: unknown): boolean {
  if (expiredAt) return false;
  return typeof expiresAt !== "string" || Date.parse(expiresAt) > Date.now();
}

function pathFromStorageUrl(
  value: string | null,
  bucket: string,
): string | null {
  if (!value) return null;
  if (!/^https?:\/\//i.test(value)) return value.replace(/^\/+/, "");
  try {
    const url = new URL(value);
    const markers = [
      `/storage/v1/object/public/${bucket}/`,
      `/storage/v1/object/sign/${bucket}/`,
      `/storage/v1/object/${bucket}/`,
    ];
    for (const marker of markers) {
      const at = url.pathname.indexOf(marker);
      if (at >= 0) {
        return decodeURIComponent(url.pathname.slice(at + marker.length));
      }
    }
  } catch {
    return null;
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(req) });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405, req);
  }

  try {
    const sb = serviceClient();
    if (!sb) {
      return jsonResponse({ error: "server_storage_not_configured" }, 500, req);
    }
    const body = await readJson<Record<string, unknown>>(req);
    if (!body || !isUuid(body.sessionId)) {
      return jsonResponse({ error: "invalid_session_id" }, 400, req);
    }
    const token = typeof body.shareToken === "string" ? body.shareToken : "";
    const authorized = await getAuthorizedSession(
      sb,
      body.sessionId,
      token,
      true,
    );
    if (!authorized.row) {
      const status = authorized.error === "session_not_found" ? 404 : 403;
      return jsonResponse({ error: authorized.error }, status, req);
    }
    const session = authorized.row;

    const { data: photos, error: photosError } = await sb
      .from("photos")
      .select("frame_index,storage_path,storage_backend,expires_at,expired_at")
      .eq("session_id", body.sessionId)
      .order("frame_index");
    if (photosError) throw photosError;

    const r2 = loadR2();
    const photoResults: Array<
      { index: number; url: string; expiresAt: string | null }
    > = [];
    for (const photo of photos ?? []) {
      if (!isAvailable(photo.expires_at, photo.expired_at)) continue;
      let url: string | null = null;
      if (photo.storage_backend === "r2") {
        if (!r2) throw new Error("r2_not_configured");
        url = await signGet(r2, photo.storage_path);
      } else {
        const signed = await sb.storage.from("photos")
          .createSignedUrl(photo.storage_path, DOWNLOAD_URL_TTL_SECONDS);
        url = signed.data?.signedUrl ?? null;
      }
      if (url) {
        photoResults.push({
          index: photo.frame_index,
          url,
          expiresAt: photo.expires_at ?? null,
        });
      }
    }

    const resolveSessionAsset = async (
      backend: unknown,
      storagePath: unknown,
      legacyUrl: unknown,
      expiresAt: unknown,
    ): Promise<string | null> => {
      if (!isAvailable(expiresAt)) return null;
      if (backend === "r2" && typeof storagePath === "string") {
        if (!r2) throw new Error("r2_not_configured");
        return await signGet(r2, storagePath);
      }
      const rawPath = typeof storagePath === "string"
        ? storagePath
        : pathFromStorageUrl(
          typeof legacyUrl === "string" ? legacyUrl : null,
          "composed",
        );
      if (rawPath) {
        const signed = await sb.storage.from("composed")
          .createSignedUrl(rawPath, DOWNLOAD_URL_TTL_SECONDS);
        if (signed.data?.signedUrl) return signed.data.signedUrl;
      }
      return typeof legacyUrl === "string" && /^https?:\/\//i.test(legacyUrl)
        ? legacyUrl
        : null;
    };

    const composedUrl = await resolveSessionAsset(
      session.final_storage_backend,
      session.final_storage_path,
      session.final_image_url,
      session.final_expires_at,
    );
    const liveVideoUrl = await resolveSessionAsset(
      session.live_storage_backend,
      session.live_storage_path,
      session.live_video_url,
      session.live_expires_at,
    );
    const hasRecordedAssets = (photos?.length ?? 0) > 0 ||
      !!session.final_storage_path || !!session.final_image_url ||
      !!session.live_storage_path || !!session.live_video_url;
    const assetsExpired = !!session.assets_expired_at ||
      (hasRecordedAssets && photoResults.length === 0 && !composedUrl &&
        !liveVideoUrl);

    return jsonResponse(
      {
        sessionId: session.id,
        composedUrl,
        liveVideoUrl,
        photos: photoResults,
        createdAt: session.created_at ?? null,
        finalExpiresAt: session.final_expires_at ?? null,
        liveExpiresAt: session.live_expires_at ?? null,
        assetsExpired,
        signedUrlExpiresIn: DOWNLOAD_URL_TTL_SECONDS,
      },
      assetsExpired ? 410 : 200,
      req,
    );
  } catch (error) {
    console.error("[shared-session]", error);
    return jsonResponse({ error: "shared_session_failed" }, 500, req);
  }
});
