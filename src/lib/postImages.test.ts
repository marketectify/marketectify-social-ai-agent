import { describe, expect, it } from "vitest";
import { createLocalPostsRepo } from "./postsRepo";
import { IMAGE_LIMITS, dataUrlToBlob, imageKind, isImageTooLarge, parseImageDataUrl } from "./postImages";

// 1x1 transparent PNG
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

describe("parseImageDataUrl", () => {
  it("reads a PNG address", () => {
    const p = parseImageDataUrl(PNG);
    expect(p?.mime).toBe("image/png");
    expect(p?.ext).toBe("png");
    expect(p?.bytes).toBeGreaterThan(50);
  });
  it("rejects other types, bad text and scripts", () => {
    expect(parseImageDataUrl("data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=")).toBeNull();
    expect(parseImageDataUrl("data:text/html;base64,PGgxPg==")).toBeNull();
    expect(parseImageDataUrl("https://example.com/a.png")).toBeNull();
    expect(parseImageDataUrl("data:image/png;base64,@@@")).toBeNull();
    expect(parseImageDataUrl("")).toBeNull();
  });
});

describe("size and blob", () => {
  it("flags too large pictures", () => {
    const big = `data:image/jpeg;base64,${"A".repeat(Math.ceil((IMAGE_LIMITS.maxBytes * 4) / 3) + 8)}`;
    expect(isImageTooLarge(big)).toBe(true);
    expect(isImageTooLarge(PNG)).toBe(false);
    expect(() => dataUrlToBlob(big)).toThrow(/too large/);
  });
  it("turns a data address into a blob with the right type", () => {
    const blob = dataUrlToBlob(PNG);
    expect(blob.type).toBe("image/png");
    expect(blob.size).toBeGreaterThan(50);
  });
  it("refuses unsupported pictures", () => {
    expect(() => dataUrlToBlob("data:image/gif;base64,R0lGODlhAQABAAAAACw=")).toThrow(/not supported/);
  });
});

describe("imageKind", () => {
  it("tells new, existing and none apart", () => {
    expect(imageKind(null)).toBe("none");
    expect(imageKind(undefined)).toBe("none");
    expect(imageKind("")).toBe("none");
    expect(imageKind(PNG)).toBe("new");
    expect(imageKind("https://x.supabase.co/storage/v1/object/sign/post-images/a.png?token=1")).toBe("existing");
  });
});

describe("local posts repo keeps the picture", () => {
  function memoryStorage() {
    const data = new Map<string, string>();
    return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
  }
  const base = { title: "T", caption: "", hashtags: [], platforms: [], status: "draft" as const, scheduledAt: null };

  it("saves, reloads, changes and removes a picture", async () => {
    const storage = memoryStorage();
    const repo = createLocalPostsRepo(storage);
    const created = await repo.create({ ...base, image: PNG });
    expect(created.image).toBe(PNG);
    const again = await createLocalPostsRepo(storage).list();
    expect(again.find((p) => p.id === created.id)?.image).toBe(PNG);
    const cleared = await repo.update(created.id, { image: null });
    expect(cleared.image).toBeNull();
  });
  it("posts without a picture still load", async () => {
    const repo = createLocalPostsRepo(memoryStorage());
    const created = await repo.create(base);
    expect(created.image ?? null).toBeNull();
    expect((await repo.list()).length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Supabase repo with a fake client (checks the order of calls and the clean-up)
// ---------------------------------------------------------------------------
import { createSupabasePostsRepo } from "./postsRepo";

function fakeClient(opts: { insertError?: string } = {}) {
  const log: string[] = [];
  const rows = new Map<string, Record<string, unknown>>();
  const row = (extra: Record<string, unknown> = {}) => ({
    id: "p1", title: "T", caption: "", hashtags: [], platforms: [], status: "draft", scheduled_at: null, image_path: null, ...extra,
  });
  let current: Record<string, unknown> = row();
  rows.set("p1", current);
  const query = (table: string) => {
    let mode = "select";
    let payload: Record<string, unknown> = {};
    const q: any = {
      select: () => q,
      insert: (v: Record<string, unknown>) => ((mode = "insert"), (payload = v), q),
      update: (v: Record<string, unknown>) => ((mode = "update"), (payload = v), q),
      delete: () => ((mode = "delete"), q),
      eq: () => q,
      order: () => q,
      limit: () => Promise.resolve({ data: [current], error: null }),
      single: () => finish(),
      maybeSingle: () => finish(),
      then: (res: (v: unknown) => unknown) => res(finish()),
    };
    const finish = () => {
      log.push(`${table}.${mode}`);
      if (mode === "insert" && opts.insertError) return { data: null, error: { message: opts.insertError } };
      if (mode === "insert" || mode === "update") current = { ...current, ...payload };
      return { data: current, error: null };
    };
    return q;
  };
  const client: any = {
    from: (t: string) => query(t),
    storage: {
      from: () => ({
        upload: async (path: string) => (log.push(`upload ${path}`), { error: null }),
        remove: async (paths: string[]) => (log.push(`remove ${paths.join(",")}`), { error: null }),
        createSignedUrls: async (paths: string[]) => ({ data: paths.map((p) => ({ path: p, signedUrl: `https://signed/${p}` })), error: null }),
      }),
    },
  };
  return { client, log };
}

describe("supabase posts repo with pictures", () => {
  const base = { title: "T", caption: "", hashtags: [], platforms: [], status: "draft" as const, scheduledAt: null };

  it("uploads a new picture into the workspace folder and returns a viewing link", async () => {
    const { client, log } = fakeClient();
    const post = await createSupabasePostsRepo(client, "ws1").create({ ...base, image: PNG });
    const upload = log.find((l) => l.startsWith("upload "));
    expect(upload).toMatch(/^upload ws1\/.+\.png$/);
    expect(post.image).toMatch(/^https:\/\/signed\/ws1\//);
  });
  it("does not upload when there is no picture", async () => {
    const { client, log } = fakeClient();
    await createSupabasePostsRepo(client, "ws1").create({ ...base, image: null });
    expect(log.some((l) => l.startsWith("upload"))).toBe(false);
  });
  it("removes the uploaded file when saving the post fails", async () => {
    const { client, log } = fakeClient({ insertError: "boom" });
    await expect(createSupabasePostsRepo(client, "ws1").create({ ...base, image: PNG })).rejects.toThrow("boom");
    expect(log.some((l) => l.startsWith("remove ws1/"))).toBe(true);
  });
  it("leaves an unchanged picture alone on update", async () => {
    const { client, log } = fakeClient();
    await createSupabasePostsRepo(client, "ws1").update("p1", { title: "New", image: "https://signed/ws1/a.png" });
    expect(log.some((l) => l.startsWith("upload") || l.startsWith("remove"))).toBe(false);
  });
  it("rejects a bad picture before anything is sent", async () => {
    const { client, log } = fakeClient();
    await expect(createSupabasePostsRepo(client, "ws1").create({ ...base, image: "data:image/gif;base64,R0lGODlhAQABAAAAACw=" })).rejects.toThrow(/not supported/);
    expect(log).toEqual([]);
  });
});
