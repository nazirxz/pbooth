import { createClient } from "npm:@supabase/supabase-js@2.47.10";
import { corsHeaders, jsonResponse, readJson } from "../_shared/http.ts";
import {
  deleteR2Keys,
  DOWNLOAD_URL_TTL_SECONDS,
  isUuid,
  loadR2,
  serviceClient,
  signGet,
} from "../_shared/r2.ts";

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

async function authorizeAdmin(req: Request) {
  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const service = serviceClient();
  const authorization = req.headers.get("authorization") ?? "";
  const token = authorization.replace(/^Bearer\s+/i, "");
  if (!url || !anonKey || !service || !token) return null;

  const authClient = createClient(url, anonKey, {
    auth: { persistSession: false },
  });
  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data.user) return null;
  const allowed = await service.from("admin_users")
    .select("user_id")
    .eq("user_id", data.user.id)
    .maybeSingle();
  return allowed.data ? { service, user: data.user } : null;
}

async function signSessionAssets(
  sb: NonNullable<ReturnType<typeof serviceClient>>,
  rows: Array<Record<string, unknown>>,
) {
  const r2 = loadR2();
  return await Promise.all(rows.map(async (row) => {
    const result = { ...row };
    const now = Date.now();
    const assets: Array<["final" | "live", string]> = [
      ["final", "final_image_url"],
      ["live", "live_video_url"],
    ];
    for (const [prefix, outputField] of assets) {
      const expiresAt = row[`${prefix}_expires_at`];
      if (typeof expiresAt === "string" && Date.parse(expiresAt) <= now) {
        result[outputField] = null;
        continue;
      }
      const backend = row[`${prefix}_storage_backend`];
      const path = row[`${prefix}_storage_path`];
      if (backend === "r2" && typeof path === "string" && r2) {
        result[outputField] = await signGet(r2, path);
      } else if (typeof path === "string") {
        const signed = await sb.storage.from("composed")
          .createSignedUrl(path, DOWNLOAD_URL_TTL_SECONDS);
        result[outputField] = signed.data?.signedUrl ?? result[outputField] ??
          null;
      }
    }
    return result;
  }));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(req) });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405, req);
  }

  const admin = await authorizeAdmin(req);
  if (!admin) return jsonResponse({ error: "admin_unauthorized" }, 403, req);
  const body = await readJson<Record<string, unknown>>(req);
  if (!body || typeof body.action !== "string") {
    return jsonResponse({ error: "invalid_request" }, 400, req);
  }
  const sb = admin.service;

  try {
    if (body.action === "me") {
      return jsonResponse(
        { authorized: true, email: admin.user.email ?? null },
        200,
        req,
      );
    }

    if (body.action === "stats") {
      const jakartaNow = new Date(Date.now() + 7 * 60 * 60 * 1000);
      jakartaNow.setUTCHours(0, 0, 0, 0);
      const todayStart = new Date(jakartaNow.getTime() - 7 * 60 * 60 * 1000)
        .toISOString();
      const [total, completed, revenue, todaySessions, todayRevenue] =
        await Promise.all([
          sb.from("sessions").select("id", { count: "exact", head: true }),
          sb.from("sessions").select("id", { count: "exact", head: true }).eq(
            "status",
            "completed",
          ),
          sb.from("payments").select("amount").eq("status", "paid"),
          sb.from("sessions").select("id", { count: "exact", head: true }).gte(
            "created_at",
            todayStart,
          ),
          sb.from("payments").select("amount").eq("status", "paid").gte(
            "paid_at",
            todayStart,
          ),
        ]);
      const error = total.error || completed.error || revenue.error ||
        todaySessions.error || todayRevenue.error;
      if (error) throw error;
      return jsonResponse(
        {
          totalSessions: total.count ?? 0,
          paidSessions: completed.count ?? 0,
          totalRevenue: (revenue.data ?? []).reduce(
            (sum, row) => sum + (row.amount ?? 0),
            0,
          ),
          todaySessions: todaySessions.count ?? 0,
          todayRevenue: (todayRevenue.data ?? []).reduce(
            (sum, row) => sum + (row.amount ?? 0),
            0,
          ),
        },
        200,
        req,
      );
    }

    if (body.action === "get-settings") {
      const { data, error } = await sb.from("app_settings")
        .select("session_price,currency,updated_at")
        .eq("key", "global")
        .single();
      if (error) throw error;
      return jsonResponse(data, 200, req);
    }

    if (body.action === "update-settings") {
      const sessionPrice = body.sessionPrice;
      if (
        !Number.isInteger(sessionPrice) || Number(sessionPrice) <= 0 ||
        Number(sessionPrice) > 100_000_000
      ) {
        return jsonResponse({ error: "invalid_session_price" }, 400, req);
      }
      const { data, error } = await sb.from("app_settings")
        .update({
          session_price: Number(sessionPrice),
          updated_at: new Date().toISOString(),
          updated_by: admin.user.id,
        })
        .eq("key", "global")
        .select("session_price,currency,updated_at")
        .single();
      if (error) throw error;
      return jsonResponse(data, 200, req);
    }

    if (body.action === "list") {
      const page = Number.isInteger(body.page)
        ? Math.max(0, Number(body.page))
        : 0;
      const pageSize = Number.isInteger(body.pageSize)
        ? Math.min(100, Math.max(1, Number(body.pageSize)))
        : 20;
      const allowedStatuses = [
        "pending_payment",
        "paid",
        "capturing",
        "completed",
        "expired",
        "cancelled",
      ];
      let query = sb.from("sessions")
        .select("*,payments!session_id(*)", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(page * pageSize, page * pageSize + pageSize - 1);
      if (
        typeof body.status === "string" && allowedStatuses.includes(body.status)
      ) {
        query = query.eq("status", body.status);
      }
      if (typeof body.dateFrom === "string") {
        query = query.gte("created_at", body.dateFrom);
      }
      if (typeof body.dateTo === "string") {
        query = query.lte("created_at", body.dateTo);
      }
      const { data, error, count } = await query;
      if (error) throw error;
      const rows = await signSessionAssets(
        sb,
        (data ?? []) as Array<Record<string, unknown>>,
      );
      return jsonResponse({ rows, total: count ?? 0 }, 200, req);
    }

    if (body.action === "photos") {
      if (!isUuid(body.sessionId)) {
        return jsonResponse({ error: "invalid_session_id" }, 400, req);
      }
      const { data, error } = await sb.from("photos")
        .select(
          "frame_index,storage_path,storage_backend,expires_at,expired_at",
        )
        .eq("session_id", body.sessionId)
        .order("frame_index");
      if (error) throw error;
      const r2 = loadR2();
      const photos: Array<{ index: number; url: string }> = [];
      for (const photo of data ?? []) {
        if (
          photo.expired_at ||
          (photo.expires_at && Date.parse(photo.expires_at) <= Date.now())
        ) continue;
        if (photo.storage_backend === "r2" && r2) {
          photos.push({
            index: photo.frame_index,
            url: await signGet(r2, photo.storage_path),
          });
        } else if (photo.storage_backend !== "r2") {
          const signed = await sb.storage.from("photos")
            .createSignedUrl(photo.storage_path, DOWNLOAD_URL_TTL_SECONDS);
          if (signed.data?.signedUrl) {
            photos.push({
              index: photo.frame_index,
              url: signed.data.signedUrl,
            });
          }
        }
      }
      return jsonResponse({ photos }, 200, req);
    }

    if (body.action === "delete") {
      if (!isUuid(body.sessionId)) {
        return jsonResponse({ error: "invalid_session_id" }, 400, req);
      }
      const [sessionResult, photoResult] = await Promise.all([
        sb.from("sessions").select("*").eq("id", body.sessionId).maybeSingle(),
        sb.from("photos").select("storage_backend,storage_path").eq(
          "session_id",
          body.sessionId,
        ),
      ]);
      if (sessionResult.error || photoResult.error) {
        throw sessionResult.error ?? photoResult.error;
      }
      if (!sessionResult.data) {
        return jsonResponse({ error: "session_not_found" }, 404, req);
      }

      const r2Keys = (photoResult.data ?? [])
        .filter((row) => row.storage_backend === "r2")
        .map((row) => row.storage_path);
      const supabasePhotos = (photoResult.data ?? [])
        .filter((row) => row.storage_backend !== "r2")
        .map((row) => row.storage_path);
      const session = sessionResult.data;
      for (const prefix of ["final", "live"] as const) {
        const backend = session[`${prefix}_storage_backend`];
        const path = session[`${prefix}_storage_path`];
        const legacyUrl =
          session[prefix === "final" ? "final_image_url" : "live_video_url"];
        if (backend === "r2" && path) r2Keys.push(path);
        if (backend !== "r2") {
          const legacyPath = path ?? pathFromStorageUrl(legacyUrl, "composed");
          if (legacyPath) {
            await sb.storage.from("composed").remove([legacyPath]);
          }
        }
      }
      const r2 = loadR2();
      if (r2Keys.length > 0 && r2) await deleteR2Keys(r2, r2Keys);
      if (supabasePhotos.length > 0) {
        await sb.storage.from("photos").remove(supabasePhotos);
      }
      const { error } = await sb.from("sessions").delete().eq(
        "id",
        body.sessionId,
      );
      if (error) throw error;
      return jsonResponse({ success: true }, 200, req);
    }

    return jsonResponse({ error: "unknown_action" }, 400, req);
  } catch (error) {
    console.error("[admin-sessions]", error);
    return jsonResponse({ error: "admin_operation_failed" }, 500, req);
  }
});
