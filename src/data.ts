import type { Platform } from "./types";

export const platformLabels: Record<Platform, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
};

export const platformColors: Record<Platform, string> = {
  facebook: "text-blue-600 dark:text-blue-400",
  instagram: "text-pink-600 dark:text-pink-400",
  tiktok: "text-cyan-700 dark:text-cyan-300",
  youtube: "text-red-600 dark:text-red-400",
};

export const platformBg: Record<Platform, string> = {
  facebook: "bg-blue-500/10 border-blue-500/30",
  instagram: "bg-pink-500/10 border-pink-500/30",
  tiktok: "bg-cyan-500/10 border-cyan-500/30",
  youtube: "bg-red-500/10 border-red-500/30",
};
