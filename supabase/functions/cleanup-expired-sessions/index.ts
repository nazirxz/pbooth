// Backwards-compatible function name for existing cron jobs. It deliberately
// performs asset cleanup only; session and payment metadata are retained.
import { cleanupHandler } from "../_shared/cleanup.ts";

Deno.serve(cleanupHandler);
