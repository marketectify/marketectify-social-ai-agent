export type TabId =
  | "overview"
  | "studio"
  | "calendar"
  | "inbox"
  | "analytics";

export type Platform = "facebook" | "instagram" | "tiktok" | "youtube";

/**
 * draft     – being written, not sent for approval yet
 * pending   – waiting for approval
 * approved  – approved and scheduled
 * published – already posted
 */
export type PostStatus = "draft" | "pending" | "approved" | "published";

export interface Post {
  id: string;
  title: string;
  caption: string;
  hashtags: string[];
  platforms: Platform[];
  status: PostStatus;
  /** ISO timestamp, or null for an unscheduled draft */
  scheduledAt: string | null;
}

export type PostInput = Omit<Post, "id">;

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
