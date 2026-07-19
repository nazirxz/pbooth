import type { SupabaseClient } from "npm:@supabase/supabase-js@2.47.10";
import { serviceClient } from "./r2.ts";
import { jsonResponse } from "./http.ts";

interface CleanupSession {
  id: string;
  final_storage_backend: string | null;
  final_storage_path: string | null;
  final_image_url: string | null;
  final_expires_at: string | null;
  live_storage_backend: string | null;
  live_storage_path: string | null;
  live_video_url: string | null;
  live_expires_at: string | null;
}

function pathFromStorageUrl(
  value: string | null,
  bucket: string,
): string | null {
  if (!value) return null;
  if (!/^https?:\/\//i.test(value)) return value.replace(/^\/+/, "");
  try {
    const url = new URL(value);
    const marker = `/storage/v1/object/public/${bucket}/`;
    const at = url.pathname.indexOf(marker);
    return at >= 0
      ? decodeURIComponent(url.pathname.slice(at + marker.length))
      : null;
  } catch {
    return null;
  }
}

async function removeSupabaseObjects(
  sb: SupabaseClient,
  bucket: string,
  paths: string[],
): Promise<number> {
  const unique = [...new Set(paths.filter(Boolean))];
  let removed = 0;
  for (let i = 0; i < unique.length; i += 100) {
    const batch = unique.slice(i, i + 100);
    const { error } = await sb.storage.from(bucket).remove(batch);
    if (error) throw error;
    removed += batch.length;
  }
  return removed;
}

export async function cleanupHandler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405, req);
  }
  const expectedSecret = Deno.env.get("CLEANUP_CRON_SECRET");
  const suppliedSecret = req.headers.get("x-cleanup-secret");
  if (!expectedSecret || !suppliedSecret || suppliedSecret !== expectedSecret) {
    return jsonResponse({ error: "unauthorized" }, 401, req);
  }
  const sb = serviceClient();
  if (!sb) return jsonResponse({ error: "supabase_not_configured" }, 500, req);

  try {
    const now = new Date().toISOString();
    const { data: expiredPhotos, error: photosError } = await sb
      .from("photos")
      .select("id,storage_backend,storage_path")
      .is("expired_at", null)
      .lte("expires_at", now)
      .limit(1000);
    if (photosError) throw photosError;

    const legacyPhotoPaths = (expiredPhotos ?? [])
      .filter((row) => row.storage_backend === "supabase")
      .map((row) => row.storage_path);
    const removedPhotos = await removeSupabaseObjects(
      sb,
      "photos",
      legacyPhotoPaths,
    );
    const photoIds = (expiredPhotos ?? []).map((row) => row.id);
    if (photoIds.length > 0) {
      const { error } = await sb.from("photos").update({ expired_at: now }).in(
        "id",
        photoIds,
      );
      if (error) throw error;
    }

    const { data: sessions, error: sessionsError } = await sb
      .from("sessions")
      .select(
        "id,final_storage_backend,final_storage_path,final_image_url,final_expires_at," +
          "live_storage_backend,live_storage_path,live_video_url,live_expires_at,assets_expired_at",
      )
      .is("assets_expired_at", null)
      .or(`final_expires_at.lte.${now},live_expires_at.lte.${now}`)
      .limit(1000);
    if (sessionsError) throw sessionsError;

    const composedPaths: string[] = [];
    const fullyExpiredIds: string[] = [];
    for (const session of (sessions ?? []) as unknown as CleanupSession[]) {
      const finalDue = !!session.final_expires_at &&
        Date.parse(session.final_expires_at) <= Date.now();
      const liveDue = !!session.live_expires_at &&
        Date.parse(session.live_expires_at) <= Date.now();
      if (finalDue && session.final_storage_backend === "supabase") {
        const path = session.final_storage_path ??
          pathFromStorageUrl(session.final_image_url, "composed");
        if (path) composedPaths.push(path);
      }
      if (liveDue && session.live_storage_backend === "supabase") {
        const path = session.live_storage_path ??
          pathFromStorageUrl(session.live_video_url, "composed");
        if (path) composedPaths.push(path);
      }
      const finalDone = !session.final_expires_at || finalDue;
      const liveDone = !session.live_expires_at || liveDue;
      if (finalDone && liveDone) fullyExpiredIds.push(session.id);
    }
    const removedComposed = await removeSupabaseObjects(
      sb,
      "composed",
      composedPaths,
    );
    if (fullyExpiredIds.length > 0) {
      const { error } = await sb.from("sessions")
        .update({ assets_expired_at: now })
        .in("id", fullyExpiredIds);
      if (error) throw error;
    }

    return jsonResponse(
      {
        success: true,
        expiredPhotoRows: photoIds.length,
        removedSupabasePhotos: removedPhotos,
        removedSupabaseComposed: removedComposed,
        expiredSessionAssets: fullyExpiredIds.length,
        sessionsDeleted: 0,
        timestamp: now,
      },
      200,
      req,
    );
  } catch (error) {
    console.error("[cleanup-expired-assets]", error);
    return jsonResponse({ error: "cleanup_failed" }, 500, req);
  }
}
