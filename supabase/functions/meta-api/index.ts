import { handleApi } from "../_shared/meta.ts";
import { makeMetaDeps } from "../_shared/meta_deps.ts";

Deno.serve((req) => handleApi(req, makeMetaDeps()));
