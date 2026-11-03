import { handleCallback } from "../_shared/linkedin.ts";
import { makeLinkedInDeps } from "../_shared/linkedin_deps.ts";

Deno.serve((req) => handleCallback(req, makeLinkedInDeps()));
