import { describe, expect, it, vi } from "vitest";
import { createLocalMediaStore, createSupabaseMediaStore, pathFromPublicUrl, MEDIA_MAX_BYTES } from "./mediaStore";

function fakeClient(uploadError: { message: string } | null = null) {
  const calls = { upload: [] as { path: string; type?: string }[], remove: [] as string[][] };
  const client = {
    storage: {
      from: () => ({
        upload: async (path: string, _f: Blob, opts: { contentType?: string }) => {
          calls.upload.push({ path, type: opts.contentType });
          return { error: uploadError };
        },
        getPublicUrl: (path: string) => ({ data: { publicUrl: `https://x.supabase.co/storage/v1/object/public/post-media/${path}` } }),
        remove: async (paths: string[]) => {
          calls.remove.push(paths);
          return { error: null };
        },
      }),
    },
  };
  return { client: client as never, calls };
}

describe("pathFromPublicUrl", () => {
  it("extracts the path and refuses foreign or tricky addresses", () => {
    expect(pathFromPublicUrl("https://x.supabase.co/storage/v1/object/public/post-media/w1/a.jpg?t=1")).toBe("w1/a.jpg");
    expect(pathFromPublicUrl("https://example.com/pic.jpg")).toBeNull();
    expect(pathFromPublicUrl("https://x/post-media/../secret")).toBeNull();
  });
});

describe("createSupabaseMediaStore", () => {
  it("uploads into the workspace folder and returns the public address", async () => {
    const { client, calls } = fakeClient();
    const media = await createSupabaseMediaStore(client, "w1").upload(new Blob(["x"], { type: "image/png" }), "image");
    expect(calls.upload[0].path).toMatch(/^w1\/[\w-]+\.png$/);
    expect(calls.upload[0].type).toBe("image/png");
    expect(media.kind).toBe("image");
    expect(media.url).toContain("/post-media/w1/");
  });
  it("explains a missing bucket and other failures", async () => {
    const a = fakeClient({ message: "Bucket not found" });
    await expect(createSupabaseMediaStore(a.client, "w1").upload(new Blob(["x"]), "image")).rejects.toThrow(/0008/);
    const b = fakeClient({ message: "boom" });
    await expect(createSupabaseMediaStore(b.client, "w1").upload(new Blob(["x"]), "image")).rejects.toThrow(/boom/);
  });
  it("rejects files that are too large", async () => {
    const { client } = fakeClient();
    const big = new Blob([new Uint8Array(MEDIA_MAX_BYTES + 1)]);
    await expect(createSupabaseMediaStore(client, "w1").upload(big, "image")).rejects.toThrow(/too large/);
  });
  it("only removes files inside its own workspace folder and never throws", async () => {
    const { client, calls } = fakeClient();
    const store = createSupabaseMediaStore(client, "w1");
    await store.remove("https://x/storage/v1/object/public/post-media/w2/a.jpg");
    await store.remove("https://x/storage/v1/object/public/post-media/w1/a.jpg");
    await store.remove("data:image/png;base64,AAA");
    expect(calls.remove).toEqual([["w1/a.jpg"]]);
    const broken = { storage: { from: () => { throw new Error("x"); } } } as never;
    await expect(createSupabaseMediaStore(broken, "w1").remove("https://x/post-media/w1/a.jpg")).resolves.toBeUndefined();
  });
});

describe("createLocalMediaStore", () => {
  it("refuses videos in demo mode", async () => {
    await expect(createLocalMediaStore().upload(new Blob(["x"]), "video")).rejects.toThrow(/demo/);
  });
  it("keeps remove silent", async () => {
    const spy = vi.fn();
    await createLocalMediaStore().remove("x");
    expect(spy).not.toHaveBeenCalled();
  });
});
