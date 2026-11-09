import type { SupabaseClient } from "@supabase/supabase-js";
import { ALL_PLATFORMS } from "./platforms";
import type { Platform, Post, PostInput, PostMedia, PostStatus } from "../types";
import { demoPosts } from "./demoData";

/** Everything the app needs to store posts. Two implementations: browser storage (demo) and Supabase. */
export interface PostsRepo {
  list(): Promise<Post[]>;
  create(input: PostInput): Promise<Post>;
  update(id: string, patch: Partial<PostInput>): Promise<Post>;
  remove(id: string): Promise<void>;
}

const PLATFORMS: Platform[] = ALL_PLATFORMS;
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
  media_url?: string | null;
  media_kind?: string | null;
  publish_error?: string | null;
  published_at?: string | null;
  external_ids?: Record<string, unknown> | null;
}

const BASE_COLUMNS = "id,title,caption,hashtags,platforms,status,scheduled_at,media_url,media_kind";
/** Columns added by 0011_meta.sql. Until that file is run the app falls back to BASE_COLUMNS. */
const COLUMNS = `${BASE_COLUMNS},publish_error,external_ids,published_at`;

/** True when the database says one of the 0011 columns does not exist yet. */
export function isMissingMetaColumn(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  return error.code === "42703" || /publish_error|external_ids|does not exist/i.test(error.message ?? "");
}

function idsFromRow(raw: Record<string, unknown> | null | undefined): Post["externalIds"] {
  const out: Partial<Record<Platform, string>> = {};
  if (raw && typeof raw === "object") {
    for (const p of PLATFORMS) if (typeof raw[p] === "string" && raw[p]) out[p] = raw[p] as string;
  }
  return out;
}

function mediaFromRow(row: PostRow): PostMedia | null {
  if (!row.media_url) return null;
  return { url: row.media_url, kind: row.media_kind === "video" ? "video" : "image" };
}

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
    media: mediaFromRow(row),
    publishError: typeof row.publish_error === "string" && row.publish_error ? row.publish_error : null,
    externalIds: idsFromRow(row.external_ids),
    publishedAt: typeof row.published_at === "string" && row.published_at ? row.published_at : null,
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
  if (patch.media !== undefined) {
    row.media_url = patch.media ? patch.media.url : null;
    row.media_kind = patch.media ? patch.media.kind : null;
  }
  return row;
}

export function createSupabasePostsRepo(client: SupabaseClient, workspaceId: string): PostsRepo {
  // Becomes false the first time the database answers that the 0011 columns are missing.
  let extra = true;
  const cols = () => (extra ? COLUMNS : BASE_COLUMNS);
  /** Runs a query; if it fails only because 0011 was not run yet, runs it again without those columns. */
  async function attempt<T>(run: () => PromiseLike<{ data: T | null; error: { message: string; code?: string } | null }>): Promise<T> {
    let res = await run();
    if (res.error && extra && isMissingMetaColumn(res.error)) {
      extra = false;
      res = await run();
    }
    if (res.error) throw new Error(res.error.message);
    return res.data as T;
  }
  return {
    async list() {
      const data = await attempt(() =>
        client
          .from("posts")
          .select(cols())
          .eq("workspace_id", workspaceId)
          .order("scheduled_at", { ascending: true, nullsFirst: false })
          .limit(2000),
      );
      return (data as unknown as PostRow[]).map(fromRow);
    },
    async create(input) {
      const data = await attempt(() =>
        client.from("posts").insert({ ...toRow(input), workspace_id: workspaceId }).select(cols()).single(),
      );
      return fromRow(data as unknown as PostRow);
    },
    async update(id, patch) {
      const data = await attempt(() =>
        client.from("posts").update(toRow(patch)).eq("id", id).eq("workspace_id", workspaceId).select(cols()).single(),
      );
      return fromRow(data as unknown as PostRow);
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
