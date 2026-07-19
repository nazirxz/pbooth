import {
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "npm:@aws-sdk/client-s3@3.1057.0";
import { getSignedUrl } from "npm:@aws-sdk/s3-request-presigner@3.1057.0";
import {
  createClient,
  type SupabaseClient,
} from "npm:@supabase/supabase-js@2.47.10";

export type StorageBackend = "supabase" | "r2";
export type AssetKind = "frame" | "composed" | "live";

export interface AssetInput {
  sessionId: string;
  shareToken: string;
  kind: AssetKind;
  frameIndex?: number;
  ext?: "gif" | "webm" | "mp4";
  contentType: string;
  sizeBytes: number;
}

export const MAX_ASSET_BYTES = 50 * 1024 * 1024;
export const UPLOAD_URL_TTL_SECONDS = 5 * 60;
export const DOWNLOAD_URL_TTL_SECONDS = 15 * 60;

export interface R2Runtime {
  bucket: string;
  client: S3Client;
}

export function serviceClient(): SupabaseClient | null {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export function loadR2(): R2Runtime | null {
  const accountId = Deno.env.get("R2_ACCOUNT_ID")?.trim();
  const endpoint = Deno.env.get("R2_ENDPOINT")?.trim() ||
    (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : "");
  const bucket = Deno.env.get("R2_BUCKET_NAME")?.trim();
  const accessKeyId = Deno.env.get("R2_ACCESS_KEY_ID")?.trim();
  const secretAccessKey = Deno.env.get("R2_SECRET_ACCESS_KEY")?.trim();
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) return null;

  return {
    bucket,
    client: new S3Client({
      region: "auto",
      endpoint: endpoint.replace(/\/$/, ""),
      credentials: { accessKeyId, secretAccessKey },
    }),
  };
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      .test(value);
}

export function mimeFor(kind: AssetKind, ext?: string): string | null {
  if (kind === "frame" || kind === "composed") return "image/jpeg";
  if (ext === "gif") return "image/gif";
  if (ext === "webm") return "video/webm";
  if (ext === "mp4") return "video/mp4";
  return null;
}

export function parseAssetInput(
  value: Record<string, unknown>,
): { input?: AssetInput; error?: string } {
  if ("key" in value || "path" in value || "storagePath" in value) {
    return { error: "client_path_not_allowed" };
  }
  const sessionId = value.sessionId;
  const shareToken = value.shareToken;
  const kind = value.kind;
  const frameIndex = value.frameIndex;
  const ext = value.ext;
  const contentType = value.contentType;
  const sizeBytes = value.sizeBytes;

  if (!isUuid(sessionId)) return { error: "invalid_session_id" };
  if (
    typeof shareToken !== "string" || shareToken.length < 32 ||
    shareToken.length > 256
  ) {
    return { error: "invalid_share_token" };
  }
  if (kind !== "frame" && kind !== "composed" && kind !== "live") {
    return { error: "invalid_asset_kind" };
  }
  if (
    kind === "frame" &&
    (!Number.isInteger(frameIndex) || Number(frameIndex) < 0 ||
      Number(frameIndex) > 3)
  ) {
    return { error: "invalid_frame_index" };
  }
  if (kind === "live" && ext !== "gif" && ext !== "webm" && ext !== "mp4") {
    return { error: "invalid_live_extension" };
  }
  const expectedType = mimeFor(kind, typeof ext === "string" ? ext : undefined);
  if (!expectedType || contentType !== expectedType) {
    return { error: "invalid_content_type" };
  }
  if (
    !Number.isSafeInteger(sizeBytes) || Number(sizeBytes) <= 0 ||
    Number(sizeBytes) > MAX_ASSET_BYTES
  ) {
    return { error: "invalid_asset_size" };
  }

  return {
    input: {
      sessionId,
      shareToken,
      kind,
      frameIndex: kind === "frame" ? Number(frameIndex) : undefined,
      ext: kind === "live" ? ext as "gif" | "webm" | "mp4" : undefined,
      contentType: expectedType,
      sizeBytes: Number(sizeBytes),
    },
  };
}

export function assetKey(
  kind: AssetKind,
  sessionId: string,
  frameIndex?: number,
  ext?: string,
): string {
  if (kind === "frame") return `frames/${sessionId}/frame_${frameIndex}.jpg`;
  if (kind === "composed") return `composed/${sessionId}/final.jpg`;
  return `live/${sessionId}/live.${ext}`;
}

export function expiryFor(kind: AssetKind, now = Date.now()): string {
  const days = kind === "frame" ? 1 : 3;
  return new Date(now + days * 24 * 60 * 60 * 1000).toISOString();
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

export async function getAuthorizedSession(
  sb: SupabaseClient,
  sessionId: string,
  shareToken: string,
  allowLegacy = false,
): Promise<{ row: Record<string, unknown> | null; error?: string }> {
  const { data, error } = await sb
    .from("sessions")
    .select(
      "id,status,share_token_hash,created_at,final_image_url,live_video_url," +
        "payment_id," +
        "final_storage_backend,final_storage_path,live_storage_backend," +
        "live_storage_path,final_expires_at,live_expires_at,assets_expired_at",
    )
    .eq("id", sessionId)
    .maybeSingle();
  if (error) return { row: null, error: error.message };
  if (!data) return { row: null, error: "session_not_found" };

  const row = data as unknown as Record<string, unknown>;
  const storedHash = row.share_token_hash as string | null;
  if (!storedHash) {
    return allowLegacy
      ? { row }
      : { row: null, error: "share_token_not_configured" };
  }
  if (!shareToken || shareToken.length < 32) {
    return { row: null, error: "invalid_share_token" };
  }
  const actualHash = await sha256Hex(shareToken);
  if (!timingSafeEqual(storedHash, actualHash)) {
    return { row: null, error: "invalid_share_token" };
  }
  return { row };
}

export async function hasPaidPayment(
  sb: SupabaseClient,
  session: Record<string, unknown>,
): Promise<boolean> {
  const paymentId = session.payment_id;
  if (typeof paymentId !== "string") return false;
  const { data, error } = await sb
    .from("payments")
    .select("status")
    .eq("id", paymentId)
    .eq("session_id", session.id)
    .maybeSingle();
  return !error && data?.status === "paid";
}

export async function signPut(
  r2: R2Runtime,
  key: string,
  contentType: string,
  contentLength: number,
): Promise<string> {
  return await getSignedUrl(
    r2.client,
    new PutObjectCommand({
      Bucket: r2.bucket,
      Key: key,
      ContentType: contentType,
      ContentLength: contentLength,
    }),
    { expiresIn: UPLOAD_URL_TTL_SECONDS },
  );
}

export async function signGet(r2: R2Runtime, key: string): Promise<string> {
  return await getSignedUrl(
    r2.client,
    new GetObjectCommand({ Bucket: r2.bucket, Key: key }),
    { expiresIn: DOWNLOAD_URL_TTL_SECONDS },
  );
}

export async function headObject(r2: R2Runtime, key: string) {
  return await r2.client.send(
    new HeadObjectCommand({ Bucket: r2.bucket, Key: key }),
  );
}

export async function deleteR2Keys(r2: R2Runtime, keys: string[]) {
  if (keys.length === 0) return;
  await r2.client.send(
    new DeleteObjectsCommand({
      Bucket: r2.bucket,
      Delete: { Objects: keys.map((Key) => ({ Key })), Quiet: true },
    }),
  );
}
