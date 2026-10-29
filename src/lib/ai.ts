import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import type { GenerateRequest, GenerateResult, GenerateSuccess, Kind } from "../../supabase/functions/generate-content/logic";

export type { CaptionsResult, ScriptResult, VisualResult, ReplyResult, GenerateRequest, Kind } from "../../supabase/functions/generate-content/logic";
export { LANGUAGES, TONES, PLATFORM_FOCUS, LIMITS } from "../../supabase/functions/generate-content/logic";

/** An error with a message that is safe and useful to show to the user. */
export class AIError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = "AIError";
  }
}

export interface Generated<T extends GenerateResult = GenerateResult> {
  kind: Kind;
  model: string;
  result: T;
  usage: { used: number; limit: number };
}

/** Pulls the `{ error: { code, message } }` body out of a failed function call. */
export async function readFunctionError(error: unknown): Promise<AIError> {
  if (error instanceof FunctionsHttpError) {
    try {
      const body = await error.context.json();
      const e = body?.error;
      if (e && typeof e.message === "string") return new AIError(String(e.code ?? "error"), e.message);
    } catch {
      /* fall through */
    }
    return new AIError("error", "The AI service returned an unexpected answer. Please try again.");
  }
  return new AIError("network", "Could not reach the AI service. Check your internet connection and try again.");
}

export async function generate(req: GenerateRequest): Promise<GenerateSuccess> {
  if (!supabase) throw new AIError("demo_mode", "AI generation needs the database connection. It is not available in demo mode.");
  const { data, error } = await supabase.functions.invoke("generate-content", { body: req, timeout: 60_000 });
  if (error) throw await readFunctionError(error);
  if (!data || typeof data !== "object" || !("result" in data)) {
    throw new AIError("error", "The AI service returned an unexpected answer. Please try again.");
  }
  return data as GenerateSuccess;
}
