import { handleRefresh } from "../_shared/youtube.ts";
import { makeDeps } from "../_shared/youtube_deps.ts";

Deno.serve((req) => handleRefresh(req, makeDeps()));
