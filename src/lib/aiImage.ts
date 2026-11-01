import { supabase } from "./supabase";
import { AIError, readFunctionError } from "./ai";
import type { Aspect, ImageRequest, ImageSuccess } from "../../supabase/functions/generate-image/logic";

export type { Aspect, ImageRequest, ImageStyle, ImageSuccess } from "../../supabase/functions/generate-image/logic";
export { ASPECTS, IMAGE_STYLES, IMAGE_LIMITS } from "../../supabase/functions/generate-image/logic";

/** Picks the allowed picture shape closest to a canvas of the given size. */
export function nearestAspect(width: number, height: number): Aspect {
  const options: [Aspect, number][] = [["1:1", 1], ["4:5", 0.8], ["9:16", 9 / 16], ["16:9", 16 / 9]];
  const ratio = width / Math.max(1, height);
  let best = options[0];
  for (const o of options) if (Math.abs(Math.log(o[1] / ratio)) < Math.abs(Math.log(best[1] / ratio))) best = o;
  return best[0];
}

export async function generateImage(req: ImageRequest): Promise<{ file: File; usage: ImageSuccess["usage"] }> {
  if (!supabase) throw new AIError("demo_mode", "AI pictures need the database connection. They are not available in demo mode.");
  const { data, error } = await supabase.functions.invoke("generate-image", { body: req, timeout: 100_000 });
  if (error) throw await readFunctionError(error);
  const image = (data as ImageSuccess | null)?.image;
  if (!image || typeof image.data !== "string" || typeof image.mimeType !== "string") {
    throw new AIError("error", "The AI service returned an unexpected answer. Please try again.");
  }
  const bytes = Uint8Array.from(atob(image.data), (c) => c.charCodeAt(0));
  const ext = image.mimeType === "image/jpeg" ? "jpg" : image.mimeType === "image/webp" ? "webp" : "png";
  return { file: new File([bytes], `ai-picture.${ext}`, { type: image.mimeType }), usage: (data as ImageSuccess).usage };
}
