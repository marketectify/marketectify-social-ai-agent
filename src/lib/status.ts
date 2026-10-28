import type { PostStatus } from "../types";

export const statusOrder: PostStatus[] = ["draft", "pending", "approved", "published"];

// Fixed (non-slate) colors on purpose: the slate scale flips between themes,
// but white text on these chips must stay readable in both.
export const statusConfig: Record<
  PostStatus,
  { label: string; dot: string; badge: string; chip: string }
> = {
  draft: {
    label: "Draft",
    dot: "bg-gray-400",
    badge: "bg-gray-500/15 text-gray-700 dark:text-gray-300 border-gray-500/30",
    chip: "bg-gray-600",
  },
  pending: {
    label: "Pending approval",
    dot: "bg-amber-500",
    badge: "bg-amber-500/15 text-amber-800 dark:text-amber-400 border-amber-500/30",
    chip: "bg-amber-700",
  },
  approved: {
    label: "Approved & scheduled",
    dot: "bg-emerald-500",
    badge: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
    chip: "bg-emerald-700",
  },
  published: {
    label: "Published",
    dot: "bg-blue-500",
    badge: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
    chip: "bg-blue-700",
  },
};
