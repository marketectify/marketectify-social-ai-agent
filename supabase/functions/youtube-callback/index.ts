import { handleCallback } from "../_shared/youtube.ts";
import { makeDeps } from "../_shared/youtube_deps.ts";

Deno.serve((req) => handleCallback(req, makeDeps()));
