import type { SupabaseClient } from "@supabase/supabase-js";
import type { Message, MessageInput, MessageKind, MessageStatus, Platform } from "../types";
import { demoMessages } from "./demoData";
import { newId } from "./postsRepo";

export interface MessagesRepo {
  list(): Promise<Message[]>;
  create(input: MessageInput): Promise<Message>;
  update(id: string, patch: Partial<Pick<Message, "status" | "reply" | "repliedAt">>): Promise<Message>;
  remove(id: string): Promise<void>;
}

export const MESSAGE_LIMITS = { name: 80, handle: 80, body: 2000, reply: 2000 } as const;

const PLATFORMS: Platform[] = ["facebook", "instagram", "tiktok", "youtube"];
const KINDS: MessageKind[] = ["comment", "dm"];
const STATUSES: MessageStatus[] = ["unread", "read", "replied"];

/** Newest first. */
export function sortMessages(messages: Message[]): Message[] {
  return [...messages].sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
}

function isMessage(x: unknown): x is Message {
  if (!x || typeof x !== "object") return false;
  const m = x as Record<string, unknown>;
  return (
    typeof m.id === "string" &&
    PLATFORMS.includes(m.platform as Platform) &&
    KINDS.includes(m.kind as MessageKind) &&
    typeof m.senderName === "string" &&
    typeof m.senderHandle === "string" &&
    typeof m.body === "string" &&
    STATUSES.includes(m.status as MessageStatus) &&
    (m.reply === null || typeof m.reply === "string") &&
    typeof m.receivedAt === "string" &&
    (m.repliedAt === null || typeof m.repliedAt === "string")
  );
}

function complete(input: MessageInput, id: string): Message {
  return {
    id,
    platform: input.platform,
    kind: input.kind,
    senderName: input.senderName,
    senderHandle: input.senderHandle,
    body: input.body,
    status: input.status ?? "unread",
    reply: input.reply ?? null,
    receivedAt: input.receivedAt,
    repliedAt: input.repliedAt ?? null,
  };
}

// ---------------------------------------------------------------------------
// Demo mode (browser storage)
// ---------------------------------------------------------------------------

const STORAGE_KEY = "marketectify.demo.messages.v1";
type StorageLike = Pick<Storage, "getItem" | "setItem">;

export function createLocalMessagesRepo(storage: StorageLike | null, now: () => Date = () => new Date()): MessagesRepo {
  let memory: Message[] | null = null;
  const persist = () => {
    try {
      storage?.setItem(STORAGE_KEY, JSON.stringify(memory));
    } catch {
      /* storage full or blocked: keep working in memory */
    }
  };
  const load = (): Message[] => {
    if (memory) return memory;
    try {
      const raw = storage?.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          memory = parsed.filter(isMessage);
          return memory;
        }
      }
    } catch {
      /* corrupt data: start from the samples */
    }
    memory = demoMessages(now());
    persist();
    return memory;
  };

  return {
    async list() {
      return load().map((m) => ({ ...m }));
    },
    async create(input) {
      const message = complete(input, newId());
      memory = [...load(), message];
      persist();
      return { ...message };
    },
    async update(id, patch) {
      const all = load();
      const index = all.findIndex((m) => m.id === id);
      if (index === -1) throw new Error("This message no longer exists.");
      const updated: Message = { ...all[index], ...patch, id };
      memory = all.map((m, i) => (i === index ? updated : m));
      persist();
      return { ...updated };
    },
    async remove(id) {
      memory = load().filter((m) => m.id !== id);
      persist();
    },
  };
}

// ---------------------------------------------------------------------------
// Real mode (Supabase table `messages`)
// ---------------------------------------------------------------------------

interface MessageRow {
  id: string;
  platform: string;
  kind: string;
  sender_name: string;
  sender_handle: string;
  body: string;
  status: string;
  reply: string | null;
  received_at: string;
  replied_at: string | null;
}

const COLUMNS = "id,platform,kind,sender_name,sender_handle,body,status,reply,received_at,replied_at";

function fromRow(r: MessageRow): Message {
  return {
    id: r.id,
    platform: PLATFORMS.includes(r.platform as Platform) ? (r.platform as Platform) : "facebook",
    kind: KINDS.includes(r.kind as MessageKind) ? (r.kind as MessageKind) : "comment",
    senderName: r.sender_name,
    senderHandle: r.sender_handle ?? "",
    body: r.body,
    status: STATUSES.includes(r.status as MessageStatus) ? (r.status as MessageStatus) : "unread",
    reply: r.reply,
    receivedAt: r.received_at,
    repliedAt: r.replied_at,
  };
}

export function createSupabaseMessagesRepo(client: SupabaseClient, workspaceId: string): MessagesRepo {
  return {
    async list() {
      const { data, error } = await client
        .from("messages")
        .select(COLUMNS)
        .eq("workspace_id", workspaceId)
        .order("received_at", { ascending: false })
        .limit(1000);
      if (error) throw new Error(error.message);
      return (data as MessageRow[]).map(fromRow);
    },
    async create(input) {
      const { data, error } = await client
        .from("messages")
        .insert({
          workspace_id: workspaceId,
          platform: input.platform,
          kind: input.kind,
          sender_name: input.senderName,
          sender_handle: input.senderHandle,
          body: input.body,
          status: input.status ?? "unread",
          reply: input.reply ?? null,
          received_at: input.receivedAt,
          replied_at: input.repliedAt ?? null,
        })
        .select(COLUMNS)
        .single();
      if (error) throw new Error(error.message);
      return fromRow(data as MessageRow);
    },
    async update(id, patch) {
      const row: Record<string, unknown> = {};
      if (patch.status !== undefined) row.status = patch.status;
      if (patch.reply !== undefined) row.reply = patch.reply;
      if (patch.repliedAt !== undefined) row.replied_at = patch.repliedAt;
      const { data, error } = await client
        .from("messages")
        .update(row)
        .eq("id", id)
        .eq("workspace_id", workspaceId)
        .select(COLUMNS)
        .single();
      if (error) throw new Error(error.message);
      return fromRow(data as MessageRow);
    },
    async remove(id) {
      const { error } = await client.from("messages").delete().eq("id", id).eq("workspace_id", workspaceId);
      if (error) throw new Error(error.message);
    },
  };
}
