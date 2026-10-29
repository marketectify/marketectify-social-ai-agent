import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Message, MessageInput } from "../types";
import { sortMessages, type MessagesRepo } from "../lib/messagesRepo";

interface MessagesContextValue {
  messages: Message[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  addMessage: (input: MessageInput) => Promise<Message>;
  updateMessage: (id: string, patch: Partial<Pick<Message, "status" | "reply" | "repliedAt" | "isLead">>) => Promise<Message>;
  deleteMessage: (id: string) => Promise<void>;
}

const MessagesContext = createContext<MessagesContextValue | null>(null);

export function MessagesProvider({ repo, children }: { repo: MessagesRepo; children: ReactNode }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setMessages(sortMessages(await repo.list()));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load your messages.");
    } finally {
      setLoading(false);
    }
  }, [repo]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const addMessage = useCallback(
    async (input: MessageInput) => {
      const created = await repo.create(input);
      setMessages((prev) => sortMessages([...prev, created]));
      return created;
    },
    [repo],
  );

  const updateMessage = useCallback(
    async (id: string, patch: Partial<Pick<Message, "status" | "reply" | "repliedAt" | "isLead">>) => {
      const updated = await repo.update(id, patch);
      setMessages((prev) => prev.map((m) => (m.id === id ? updated : m)));
      return updated;
    },
    [repo],
  );

  const deleteMessage = useCallback(
    async (id: string) => {
      await repo.remove(id);
      setMessages((prev) => prev.filter((m) => m.id !== id));
    },
    [repo],
  );

  const value = useMemo(
    () => ({ messages, loading, error, reload, addMessage, updateMessage, deleteMessage }),
    [messages, loading, error, reload, addMessage, updateMessage, deleteMessage],
  );
  return <MessagesContext.Provider value={value}>{children}</MessagesContext.Provider>;
}

export function useMessages(): MessagesContextValue {
  const ctx = useContext(MessagesContext);
  if (!ctx) throw new Error("useMessages must be used inside <MessagesProvider>");
  return ctx;
}
