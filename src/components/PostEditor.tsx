import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, Check, Clock, ImagePlus, Loader2, Trash2, X } from "lucide-react";
import type { Platform, Post, PostInput, PostMedia, PostStatus } from "../types";
import { platformLabels } from "../data";
import { platformIcons } from "./PlatformIcon";
import { usePosts } from "../context/PostsContext";
import { useToast } from "../context/ToastContext";
import { statusConfig } from "../lib/status";
import { fromLocalInputValue, toLocalInputValue } from "../lib/dates";
import { defaultSchedule } from "../lib/schedule";
import { parseHashtags } from "../lib/hashtags";

const CAPTION_LIMIT = 2200;
const ALL_PLATFORMS = Object.keys(platformLabels) as Platform[];

type Busy = "save" | "pending" | "approve" | "draft" | "delete" | null;

interface PostEditorProps {
  /** The post to edit, or null to create a new one. */
  post: Post | null;
  /** Day pre-selected when creating a post from the calendar. */
  defaultDate?: Date;
  /** Values to pre-fill when creating a new post (for example from the AI Studio). */
  initial?: Partial<Pick<PostInput, "title" | "caption" | "hashtags" | "platforms">> & {
    /** A finished picture (for example from the Design Studio) that is uploaded when the post is saved. */
    mediaFile?: Blob;
  };
  onClose: () => void;
}

export default function PostEditor({ post, defaultDate, initial, onClose }: PostEditorProps) {
  const { createPost, updatePost, deletePost, uploadMedia, discardMedia } = usePosts();
  const toast = useToast();
  const isNew = post === null;
  const status: PostStatus = post?.status ?? "draft";
  const locked = status === "published";

  const [title, setTitle] = useState(post?.title ?? initial?.title ?? "");
  const [caption, setCaption] = useState(post?.caption ?? initial?.caption ?? "");
  const [hashtagText, setHashtagText] = useState((post?.hashtags ?? initial?.hashtags ?? []).join(" "));
  const [platforms, setPlatforms] = useState<Platform[]>(post?.platforms ?? initial?.platforms ?? []);
  const [schedule, setSchedule] = useState(
    post ? toLocalInputValue(post.scheduledAt) : defaultSchedule(defaultDate),
  );
  // The picture of the post: one that is already stored, or a new file waiting to be uploaded on save.
  const [media, setMedia] = useState<PostMedia | null>(post?.media ?? null);
  const [pendingFile, setPendingFile] = useState<Blob | null>(initial?.mediaFile ?? null);
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (!pendingFile) {
      setPendingUrl(null);
      return;
    }
    const url = URL.createObjectURL(pendingFile);
    setPendingUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [pendingFile]);

  const pickFile = (file: File | undefined) => {
    if (!file) return;
    if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) {
      setError("Please choose a PNG, JPG or WebP picture.");
      return;
    }
    setError(null);
    setPendingFile(file);
  };

  const togglePlatform = (p: Platform) =>
    setPlatforms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));

  /** Returns an error message, or null when the post can be saved with `target` status. */
  const validate = (target: PostStatus): string | null => {
    if (!title.trim()) return "Please give the post a title.";
    if (target === "pending" || target === "approved") {
      if (platforms.length === 0) return "Choose at least one platform.";
      const when = fromLocalInputValue(schedule);
      if (!when) return "Pick a date and time.";
      if (target === "approved" && new Date(when).getTime() <= Date.now()) {
        return "Pick a time in the future so the post can be scheduled.";
      }
    }
    return null;
  };

  const run = async (kind: Exclude<Busy, null | "delete">, target: PostStatus, successMessage: string) => {
    const problem = validate(target);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setBusy(kind);
    let uploaded: PostMedia | null = null;
    try {
      if (pendingFile) uploaded = await uploadMedia(pendingFile, "image");
      const input: PostInput = {
        title: title.trim(),
        caption: caption.trim(),
        hashtags: parseHashtags(hashtagText),
        platforms,
        status: target,
        scheduledAt: fromLocalInputValue(schedule),
        media: uploaded ?? media,
      };
      try {
        if (post) await updatePost(post.id, input);
        else await createPost(input);
      } catch (e) {
        if (uploaded) void discardMedia(uploaded.url); // do not leave a file nobody uses
        throw e;
      }
      // The old picture was replaced or removed: delete the file that is no longer used.
      if (post?.media && post.media.url !== input.media?.url) void discardMedia(post.media.url);
      toast.success(successMessage);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save. Please try again.");
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!post) return;
    setBusy("delete");
    setError(null);
    try {
      await deletePost(post.id);
      toast.success("Post deleted.");
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete. Please try again.");
      setBusy(null);
    }
  };

  const fieldClass =
    "w-full px-3.5 rounded-xl bg-slate-100/50 border border-slate-200 text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/20 transition-all disabled:opacity-60";
  const anyBusy = busy !== null;
  const statusInfo = statusConfig[status];

  const buttonBase =
    "h-11 px-4 rounded-xl text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2";

  // Rendered on <body> so no parent layout (such as `space-y-*` margins) can shift it.
  return createPortal(
    <>
      <div
        className="fixed inset-0 bg-black/40 dark:bg-black/60 z-50 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="post-editor-title"
        className="fixed right-0 top-0 bottom-0 w-full sm:w-[520px] z-50 glass border-l border-slate-200 flex flex-col animate-slide-in"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 p-5 border-b border-slate-200">
          <div className="min-w-0">
            <h3 id="post-editor-title" className="text-lg font-bold text-slate-900">
              {isNew ? "New post" : locked ? "Published post" : "Edit post"}
            </h3>
            <span
              className={`inline-flex items-center gap-1.5 mt-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${statusInfo.badge}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dot}`} />
              {statusInfo.label}
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5 text-slate-600" />
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto scrollbar-thin p-5 space-y-4">
          <div>
            <label htmlFor="post-title" className="text-xs font-semibold text-slate-600 mb-1.5 block">
              Title
            </label>
            <input
              id="post-title"
              ref={titleRef}
              className={`${fieldClass} h-11`}
              value={title}
              maxLength={120}
              disabled={locked}
              placeholder="e.g. Product launch teaser"
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="post-caption" className="text-xs font-semibold text-slate-600">
                Caption
              </label>
              <span className={`text-[11px] ${caption.length > CAPTION_LIMIT * 0.95 ? "text-amber-700 dark:text-amber-400" : "text-slate-500"}`}>
                {caption.length}/{CAPTION_LIMIT}
              </span>
            </div>
            <textarea
              id="post-caption"
              className={`${fieldClass} py-3 resize-none`}
              rows={4}
              value={caption}
              maxLength={CAPTION_LIMIT}
              disabled={locked}
              placeholder="Write the post text..."
              onChange={(e) => setCaption(e.target.value)}
            />
          </div>

          <div>
            <label htmlFor="post-hashtags" className="text-xs font-semibold text-slate-600 mb-1.5 block">
              Hashtags
            </label>
            <input
              id="post-hashtags"
              className={`${fieldClass} h-11`}
              value={hashtagText}
              disabled={locked}
              placeholder="ai growth marketing"
              onChange={(e) => setHashtagText(e.target.value)}
            />
            <div className="flex flex-wrap gap-1.5 mt-2 min-h-[1.5rem]">
              {parseHashtags(hashtagText).map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 rounded-md bg-blue-500/15 text-blue-700 dark:text-blue-300 text-xs font-medium border border-blue-500/20"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-600 mb-1.5">Picture</p>
            {(pendingUrl ?? media?.url) ? (
              <div className="flex items-start gap-3">
                <img
                  src={pendingUrl ?? media?.url}
                  alt="Picture of this post"
                  className="w-28 h-28 object-cover rounded-xl border border-slate-200 bg-slate-100/50"
                />
                {!locked && (
                  <div className="flex flex-col gap-2">
                    <button type="button" onClick={() => fileInput.current?.click()} className="h-9 px-3 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-100/60">
                      Change picture
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPendingFile(null);
                        setMedia(null);
                      }}
                      className="h-9 px-3 rounded-lg border border-slate-200 text-xs font-medium text-red-700 dark:text-red-300 hover:bg-red-500/10"
                    >
                      Remove picture
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                type="button"
                disabled={locked}
                onClick={() => fileInput.current?.click()}
                className="inline-flex items-center gap-2 h-10 px-3 rounded-xl border border-dashed border-slate-300 text-sm text-slate-700 hover:bg-slate-100/50 disabled:opacity-60"
              >
                <ImagePlus className="w-4 h-4" aria-hidden="true" /> Add a picture
              </button>
            )}
            <input
              ref={fileInput}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              aria-label="Choose a picture file"
              onChange={(e) => {
                pickFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </div>

          <fieldset disabled={locked}>
            <legend className="text-xs font-semibold text-slate-600 mb-1.5">Publish to</legend>
            <div className="grid grid-cols-2 gap-2">
              {ALL_PLATFORMS.map((p) => {
                const Icon = platformIcons[p];
                const selected = platforms.includes(p);
                return (
                  <button
                    key={p}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => togglePlatform(p)}
                    className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all disabled:opacity-60 ${
                      selected
                        ? "bg-blue-500/15 border-blue-500/40 text-slate-900"
                        : "bg-slate-100/30 border-slate-200 text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${selected ? "text-blue-600 dark:text-blue-400" : "text-slate-500"}`} />
                    <span className="text-sm font-medium flex-1">{platformLabels[p]}</span>
                    {selected && <Check className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div>
            <label htmlFor="post-schedule" className="text-xs font-semibold text-slate-600 mb-1.5 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" /> Date and time
            </label>
            <input
              id="post-schedule"
              type="datetime-local"
              className={`${fieldClass} h-11`}
              value={schedule}
              disabled={locked}
              onChange={(e) => setSchedule(e.target.value)}
            />
            <p className="text-[11px] text-slate-500 mt-1.5">
              Leave empty to keep it as an unscheduled draft. Times use your local time zone.
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl px-3 py-2.5 text-sm border bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-400"
            >
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="p-5 border-t border-slate-200 space-y-3">
          {!locked && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(status === "draft" || status === "pending") && (
                <button
                  onClick={() => run("approve", "approved", "Approved and scheduled.")}
                  disabled={anyBusy}
                  className={`${buttonBase} bg-emerald-700 text-white hover:bg-emerald-800 sm:col-span-2`}
                >
                  {busy === "approve" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Approve &amp; schedule
                </button>
              )}
              {status === "draft" && (
                <button
                  onClick={() => run("pending", "pending", "Sent for approval.")}
                  disabled={anyBusy}
                  className={`${buttonBase} bg-slate-100 border border-slate-200 text-slate-900 hover:bg-slate-200`}
                >
                  {busy === "pending" && <Loader2 className="w-4 h-4 animate-spin" />}
                  Send for approval
                </button>
              )}
              {(status === "pending" || status === "approved") && (
                <button
                  onClick={() => run("draft", "draft", "Moved back to drafts.")}
                  disabled={anyBusy}
                  className={`${buttonBase} bg-slate-100 border border-slate-200 text-slate-900 hover:bg-slate-200`}
                >
                  {busy === "draft" && <Loader2 className="w-4 h-4 animate-spin" />}
                  {status === "approved" ? "Unschedule" : "Back to draft"}
                </button>
              )}
              <button
                onClick={() => run("save", status, isNew ? "Draft saved." : "Changes saved.")}
                disabled={anyBusy}
                className={`${buttonBase} ${
                  status === "approved"
                    ? "bg-blue-600 text-white hover:bg-blue-700 sm:col-span-2"
                    : "bg-blue-600 text-white hover:bg-blue-700"
                }`}
              >
                {busy === "save" && <Loader2 className="w-4 h-4 animate-spin" />}
                {isNew ? "Save draft" : "Save changes"}
              </button>
            </div>
          )}

          {!isNew && (
            <div className="flex items-center justify-between gap-3">
              {confirmDelete ? (
                <>
                  <span className="text-sm text-slate-700">Delete this post for good?</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setConfirmDelete(false)}
                      disabled={anyBusy}
                      className="h-9 px-3 rounded-lg text-sm font-medium border border-slate-200 hover:bg-slate-100"
                    >
                      Keep
                    </button>
                    <button
                      onClick={remove}
                      disabled={anyBusy}
                      className="h-9 px-3 rounded-lg text-sm font-semibold bg-red-600 text-white hover:bg-red-700 flex items-center gap-1.5 disabled:opacity-60"
                    >
                      {busy === "delete" && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      Delete
                    </button>
                  </div>
                </>
              ) : (
                <button
                  onClick={() => setConfirmDelete(true)}
                  disabled={anyBusy}
                  className="h-9 px-2 rounded-lg text-sm font-medium text-red-700 dark:text-red-400 hover:bg-red-500/10 flex items-center gap-1.5"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete post
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </>,
    document.body,
  );
}
