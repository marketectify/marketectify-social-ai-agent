import type { SupabaseClient } from "@supabase/supabase-js";
import type { Platform, Post, PostInput, PostStatus } from "../types";
import { demoPosts } from "./demoData";

/** Everything the app needs to store posts. Two implementations: browser storage (demo) and Supabase. */
export interface PostsRepo {
  list(): Promise<Post[]>;
  create(input: PostInput): Promise<Post>;
  update(id: string, patch: Partial<PostInput>): Promise<Post>;
  remove(id: string): Promise<void>;
}

const PLATFORMS: Platform[] = ["facebook", "instagram", "tiktok", "youtube"];
const STATUSES: PostStatus[] = ["draft", "pending", "approved", "published"];

export function newId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function isPost(x: unknown): x is Post {
  if (!x || typeof x !== "object") return false;
  const p = x as Record<string, unknown>;
  return (
    typeof p.id === "string" &&
    typeof p.title === "string" &&
    typeof p.caption === "string" &&
    Array.isArray(p.hashtags) &&
    Array.isArray(p.platforms) &&
    typeof p.status === "string" &&
    STATUSES.includes(p.status as PostStatus) &&
    (p.scheduledAt === null || typeof p.scheduledAt === "string")
  );
}

// ---------------------------------------------------------------------------
// Demo mode: posts live in the browser (localStorage)
// ---------------------------------------------------------------------------

const STORAGE_KEY = "marketectify.demo.posts.v1";

type StorageLike = Pick<Storage, "getItem" | "setItem">;

export function createLocalPostsRepo(
  storage: StorageLike | null,
  now: () => Date = () => new Date(),
): PostsRepo {
  let memory: Post[] | null = null;

  const persist = () => {
    try {
      storage?.setItem(STORAGE_KEY, JSON.stringify(memory));
    } catch {
      // Storage full or blocked: keep working in memory for this visit.
    }
  };

  const load = (): Post[] => {
    if (memory) return memory;
    try {
      const raw = storage?.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          memory = parsed.filter(isPost);
          return memory;
        }
      }
    } catch {
      // Corrupt data: fall through and start from the sample posts.
    }
    memory = demoPosts(now());
    persist();
    return memory;
  };

  return {
    async list() {
      return load().map((p) => ({ ...p }));
    },
    async create(input) {
      const post: Post = { ...input, id: newId() };
      memory = [...load(), post];
      persist();
      return { ...post };
    },
    async update(id, patch) {
      const posts = load();
      const index = posts.findIndex((p) => p.id === id);
      if (index === -1) throw new Error("This post no longer exists.");
      const updated: Post = { ...posts[index], ...patch, id };
      memory = posts.map((p, i) => (i === index ? updated : p));
      persist();
      return { ...updated };
    },
    async remove(id) {
      memory = load().filter((p) => p.id !== id);
      persist();
    },
  };
}

// ---------------------------------------------------------------------------
// Real mode: posts live in Supabase (table `posts`, protected by row level security)
// ---------------------------------------------------------------------------

interface PostRow {
  id: string;
  title: string;
  caption: string;
  hashtags: string[];
  platforms: string[];
  status: string;
  scheduled_at: string | null;
}

const COLUMNS = "id,title,caption,hashtags,platforms,status,scheduled_at";

function fromRow(row: PostRow): Post {
  return {
    id: row.id,
    title: row.title,
    caption: row.caption,
    hashtags: row.hashtags ?? [],
    platforms: (row.platforms ?? []).filter((p): p is Platform =>
      PLATFORMS.includes(p as Platform),
    ),
    status: STATUSES.includes(row.status as PostStatus) ? (row.status as PostStatus) : "draft",
    scheduledAt: row.scheduled_at,
  };
}

function toRow(patch: Partial<PostInput>) {
  const row: Record<string, unknown> = {};
  if (patch.title !== undefined) row.title = patch.title;
  if (patch.caption !== undefined) row.caption = patch.caption;
  if (patch.hashtags !== undefined) row.hashtags = patch.hashtags;
  if (patch.platforms !== undefined) row.platforms = patch.platforms;
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.scheduledAt !== undefined) row.scheduled_at = patch.scheduledAt;
  return row;
}

export function createSupabasePostsRepo(client: SupabaseClient, workspaceId: string): PostsRepo {
  return {
    async list() {
      const { data, error } = await client
        .from("posts")
        .select(COLUMNS)
        .eq("workspace_id", workspaceId)
        .order("scheduled_at", { ascending: true, nullsFirst: false })
        .limit(2000);
      if (error) throw new Error(error.message);
      return (data as PostRow[]).map(fromRow);
    },
    async create(input) {
      const { data, error } = await client
        .from("posts")
        .insert({ ...toRow(input), workspace_id: workspaceId })
        .select(COLUMNS)
        .single();
      if (error) throw new Error(error.message);
      return fromRow(data as PostRow);
    },
    async update(id, patch) {
      const { data, error } = await client
        .from("posts")
        .update(toRow(patch))
        .eq("id", id)
        .eq("workspace_id", workspaceId)
        .select(COLUMNS)
        .single();
      if (error) throw new Error(error.message);
      return fromRow(data as PostRow);
    },
    async remove(id) {
      const { error } = await client
        .from("posts")
        .delete()
        .eq("id", id)
        .eq("workspace_id", workspaceId);
      if (error) throw new Error(error.message);
    },
  };
}
