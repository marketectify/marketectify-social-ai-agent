import { handleStart } from "../_shared/linkedin.ts";
import { makeLinkedInDeps } from "../_shared/linkedin_deps.ts";

Deno.serve((req) => handleStart(req, makeLinkedInDeps()));
