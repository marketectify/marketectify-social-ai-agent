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

export type MessageKind = "comment" | "dm";
export type MessageStatus = "unread" | "read" | "replied";

/** A customer comment or direct message. */
export interface Message {
  id: string;
  platform: Platform;
  kind: MessageKind;
  senderName: string;
  senderHandle: string;
  body: string;
  status: MessageStatus;
  /** The reply that was sent (or copied to the platform), if any. */
  reply: string | null;
  /** ISO timestamp */
  receivedAt: string;
  repliedAt: string | null;
}

export type MessageInput = Omit<Message, "id" | "status" | "reply" | "repliedAt"> &
  Partial<Pick<Message, "status" | "reply" | "repliedAt">>;
