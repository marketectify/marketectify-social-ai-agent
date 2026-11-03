import { handleCron } from "../_shared/meta.ts";
import { makeMetaDeps } from "../_shared/meta_deps.ts";

Deno.serve((req) => handleCron(req, makeMetaDeps()));
