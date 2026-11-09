import type { Platform } from "../types";

/** Every platform the app knows. */
export const ALL_PLATFORMS: Platform[] = ["facebook", "instagram", "linkedin", "tiktok", "youtube", "gbp"];

/** Platforms a post can be planned for. */
export const POST_PLATFORMS: Platform[] = ["facebook", "instagram", "linkedin", "gbp", "tiktok", "youtube"];

/** Platforms whose posts the server publishes by itself once they are connected. */
export const AUTO_PUBLISH_PLATFORMS: Platform[] = ["facebook", "instagram", "linkedin", "gbp", "youtube"];

export const isAutoPublish = (p: Platform): boolean => AUTO_PUBLISH_PLATFORMS.includes(p);
