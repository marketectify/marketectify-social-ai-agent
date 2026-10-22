export type TabId =
  | "overview"
  | "studio"
  | "calendar"
  | "inbox"
  | "analytics";

export type Platform = "facebook" | "instagram" | "tiktok" | "youtube";

export type PostStatus = "pending" | "approved" | "published";

export interface ScheduledPost {
  id: string;
  title: string;
  caption: string;
  date: string;
  time: string;
  platforms: Platform[];
  status: PostStatus;
  thumbnailGradient: string;
  hashtags: string[];
}

export interface InboxMessage {
  id: string;
  platform: Platform;
  sender: string;
  senderHandle: string;
  avatarColor: string;
  message: string;
  timestamp: string;
  unread: boolean;
  type: "comment" | "dm";
  aiSuggestedReply?: string;
}

export interface StatCard {
  label: string;
  value: string;
  trend: string;
  trendUp: boolean;
  icon: string;
  gradient: string;
}
