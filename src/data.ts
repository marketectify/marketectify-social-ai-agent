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

export const engagementData = [
  { platform: "Facebook", value: 82, color: "bg-blue-500", reach: "640K", engagement: "6.2%" },
  { platform: "Instagram", value: 95, color: "bg-pink-500", reach: "980K", engagement: "8.9%" },
  { platform: "TikTok", value: 78, color: "bg-cyan-400", reach: "1.2M", engagement: "9.5%" },
  { platform: "YouTube", value: 65, color: "bg-red-500", reach: "420K", engagement: "5.1%" },
];

export const monthlyChartData = [
  { month: "May", facebook: 45, instagram: 60, tiktok: 55, youtube: 30 },
  { month: "Jun", facebook: 52, instagram: 68, tiktok: 70, youtube: 35 },
  { month: "Jul", facebook: 48, instagram: 75, tiktok: 85, youtube: 40 },
  { month: "Aug", facebook: 60, instagram: 82, tiktok: 90, youtube: 48 },
  { month: "Sep", facebook: 65, instagram: 88, tiktok: 95, youtube: 52 },
  { month: "Oct", facebook: 72, instagram: 95, tiktok: 100, youtube: 58 },
];

export const leadFunnelData = [
  { stage: "AI DMs Sent", count: 8420, percentage: 100 },
  { stage: "Leads Captured", count: 1247, percentage: 15 },
  { stage: "Qualified Leads", count: 683, percentage: 8 },
  { stage: "Converted", count: 214, percentage: 2.5 },
];
