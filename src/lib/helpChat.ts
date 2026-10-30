import { supabase } from "./supabase";
import { AIError, readFunctionError } from "./ai";
import type { ChatMessage, HelpSuccess } from "../../supabase/functions/help-assistant/logic";

export type { ChatMessage, HelpSuccess } from "../../supabase/functions/help-assistant/logic";
export { HELP_LIMITS } from "../../supabase/functions/help-assistant/logic";

/** Starter questions shown in an empty chat. */
export const SUGGESTIONS = [
  "Design Studio mein post kaise banate hain?",
  "AI Studio mein error aaye to kya karun?",
  "YouTube kaise connect karun?",
  "Kaun si secrets Supabase mein chahiye?",
];

/** Keeps only the last messages and drops anything that cannot be sent (errors, empty text). */
export function toHistory(messages: ChatMessage[], max = 12): ChatMessage[] {
  const clean = messages.filter((m) => m.text.trim().length > 0).slice(-max);
  while (clean.length && clean[0].role !== "user") clean.shift();
  return clean;
}

export async function askHelp(messages: ChatMessage[]): Promise<HelpSuccess> {
  if (!supabase) throw new AIError("demo_mode", "The assistant needs the database connection. It is not available in demo mode.");
  const { data, error } = await supabase.functions.invoke("help-assistant", { body: { messages: toHistory(messages) }, timeout: 60_000 });
  if (error) throw await readFunctionError(error);
  if (!data || typeof data !== "object" || typeof (data as HelpSuccess).reply !== "string") {
    throw new AIError("error", "The assistant returned an unexpected answer. Please try again.");
  }
  return data as HelpSuccess;
}
