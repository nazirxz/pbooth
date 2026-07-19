import { MAX_ASSET_BYTES, parseAssetInput, sha256Hex } from "./r2.ts";

const valid = {
  sessionId: "123e4567-e89b-42d3-a456-426614174000",
  shareToken: "abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG",
  kind: "frame",
  frameIndex: 0,
  contentType: "image/jpeg",
  sizeBytes: 23 * 1024 * 1024,
};

Deno.test("accepts a valid DSLR frame", () => {
  const result = parseAssetInput(valid);
  if (!result.input || result.input.sizeBytes !== valid.sizeBytes) {
    throw new Error(result.error ?? "valid input was rejected");
  }
});

Deno.test("rejects assets larger than 50 MiB", () => {
  const result = parseAssetInput({ ...valid, sizeBytes: MAX_ASSET_BYTES + 1 });
  if (result.error !== "invalid_asset_size") {
    throw new Error("oversize accepted");
  }
});

Deno.test("rejects client-controlled object paths", () => {
  const result = parseAssetInput({
    ...valid,
    path: "../../another-session/photo.jpg",
  });
  if (result.error !== "client_path_not_allowed") {
    throw new Error("path injection accepted");
  }
});

Deno.test("rejects frame indexes outside the four-shot session", () => {
  const result = parseAssetInput({ ...valid, frameIndex: 4 });
  if (result.error !== "invalid_frame_index") {
    throw new Error("invalid frame accepted");
  }
});

Deno.test("share token hashing is stable SHA-256 hex", async () => {
  const hash = await sha256Hex("test-token");
  if (
    hash !== "4c5dc9b7708905f77f5e5d16316b5dfb425e68cb326dcd55a860e90a7707031e"
  ) {
    throw new Error("unexpected token hash");
  }
});
