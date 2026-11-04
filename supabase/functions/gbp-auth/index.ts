import { handleStart } from "../_shared/gbp.ts";
import { makeGbpDeps } from "../_shared/gbp_deps.ts";

Deno.serve((req) => handleStart(req, makeGbpDeps()));
