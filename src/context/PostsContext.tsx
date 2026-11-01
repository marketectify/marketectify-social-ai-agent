import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Post, PostInput, PostMedia } from "../types";
import type { PostsRepo } from "../lib/postsRepo";
import type { MediaStore } from "../lib/mediaStore";

interface PostsContextValue {
  posts: Post[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  createPost: (input: PostInput) => Promise<Post>;
  updatePost: (id: string, patch: Partial<PostInput>) => Promise<Post>;
  deletePost: (id: string) => Promise<void>;
  /** Stores a picture or video for a post and returns what to save on the post. */
  uploadMedia: (file: Blob, kind: PostMedia["kind"]) => Promise<PostMedia>;
  /** Removes a stored file that is no longer used by a post (best effort). */
  discardMedia: (url: string) => Promise<void>;
}

const PostsContext = createContext<PostsContextValue | null>(null);

/** Posts with a date first (earliest first), then unscheduled drafts. */
export function sortPosts(posts: Post[]): Post[] {
  return [...posts].sort((a, b) => {
    if (a.scheduledAt && b.scheduledAt) return a.scheduledAt.localeCompare(b.scheduledAt);
    if (a.scheduledAt) return -1;
    if (b.scheduledAt) return 1;
    return a.title.localeCompare(b.title);
  });
}

export function PostsProvider({ repo, media, children }: { repo: PostsRepo; media: MediaStore; children: ReactNode }) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setPosts(sortPosts(await repo.list()));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load your posts.");
    } finally {
      setLoading(false);
    }
  }, [repo]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const createPost = useCallback(
    async (input: PostInput) => {
      const created = await repo.create(input);
      setPosts((prev) => sortPosts([...prev, created]));
      return created;
    },
    [repo],
  );

  const updatePost = useCallback(
    async (id: string, patch: Partial<PostInput>) => {
      const updated = await repo.update(id, patch);
      setPosts((prev) => sortPosts(prev.map((p) => (p.id === id ? updated : p))));
      return updated;
    },
    [repo],
  );

  const deletePost = useCallback(
    async (id: string) => {
      const old = posts.find((p) => p.id === id);
      await repo.remove(id);
      setPosts((prev) => prev.filter((p) => p.id !== id));
      if (old?.media) void media.remove(old.media.url);
    },
    [repo, media, posts],
  );

  const uploadMedia = useCallback((file: Blob, kind: PostMedia["kind"]) => media.upload(file, kind), [media]);
  const discardMedia = useCallback((url: string) => media.remove(url), [media]);

  const value = useMemo(
    () => ({ posts, loading, error, reload, createPost, updatePost, deletePost, uploadMedia, discardMedia }),
    [posts, loading, error, reload, createPost, updatePost, deletePost, uploadMedia, discardMedia],
  );

  return <PostsContext.Provider value={value}>{children}</PostsContext.Provider>;
}

export function usePosts(): PostsContextValue {
  const ctx = useContext(PostsContext);
  if (!ctx) throw new Error("usePosts must be used inside <PostsProvider>");
  return ctx;
}
