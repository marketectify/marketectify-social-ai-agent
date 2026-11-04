import { handleCallback } from "../_shared/meta.ts";
import { makeMetaDeps } from "../_shared/meta_deps.ts";

Deno.serve((req) => handleCallback(req, makeMetaDeps()));
