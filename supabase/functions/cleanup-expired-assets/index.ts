import { cleanupHandler } from "../_shared/cleanup.ts";

Deno.serve(cleanupHandler);
