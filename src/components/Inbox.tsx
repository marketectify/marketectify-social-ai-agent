import { useState } from "react";
import {
  Inbox as InboxIcon,
  Send,
  Bot,
  Zap,
  Facebook,
  Instagram,
  Youtube,
  Check,
  Edit3,
  MessageSquare,
  Clock,
} from "lucide-react";
import type { Platform, InboxMessage } from "../types";
import { inboxMessages, platformLabels } from "../data";

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.73 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
    </svg>
  );
}

type IconType = React.ComponentType<{ className?: string }>;

const platformIcons: Record<Platform, IconType> = {
  facebook: Facebook,
  instagram: Instagram,
  tiktok: TikTokIcon,
  youtube: Youtube,
};

const platformColor: Record<Platform, string> = {
  facebook: "text-blue-400",
  instagram: "text-pink-400",
  tiktok: "text-cyan-300",
  youtube: "text-red-400",
};

export default function Inbox() {
  const [messages, setMessages] = useState<InboxMessage[]>(inboxMessages);
  const [selectedId, setSelectedId] = useState<string>(messages[0]?.id ?? "");
  const [autoPilot, setAutoPilot] = useState(true);
  const [replyText, setReplyText] = useState("");

  const selected = messages.find((m) => m.id === selectedId) ?? messages[0];

  const handleSelect = (msg: InboxMessage) => {
    setSelectedId(msg.id);
    setReplyText(msg.aiSuggestedReply ?? "");
    if (msg.unread) {
      setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, unread: false } : m)));
    }
  };

  const handleSend = () => {
    if (!replyText.trim()) return;
    setMessages((prev) => prev.map((m) => (m.id === selectedId ? { ...m, unread: false } : m)));
    setReplyText("");
  };

  const unreadCount = messages.filter((m) => m.unread).length;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <InboxIcon className="w-6 h-6 text-violet-400" />
            Unified AI Inbox
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            All your DMs & comments in one stream · {unreadCount} unread
          </p>
        </div>

        {/* Auto-pilot toggle */}
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl glass-light">
          <div className="relative">
            <Zap className={`w-5 h-5 ${autoPilot ? "text-violet-400" : "text-slate-500"}`} />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">AI Auto-Pilot Mode</p>
            <p className="text-[10px] text-slate-500">Auto-reply to comments & DMs</p>
          </div>
          <button
            onClick={() => setAutoPilot(!autoPilot)}
            className={`relative w-12 h-6 rounded-full transition-all ${
              autoPilot ? "bg-gradient-to-r from-violet-500 to-indigo-500 glow-purple" : "bg-slate-700"
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                autoPilot ? "translate-x-6" : "translate-x-0"
              }`}
            />
          </button>
          <span className={`text-xs font-bold ${autoPilot ? "text-violet-300" : "text-slate-500"}`}>
            {autoPilot ? "ON" : "OFF"}
          </span>
        </div>
      </div>

      {/* Inbox layout */}
      <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-280px)] min-h-[500px]">
        {/* Message list */}
        <div className="w-full lg:w-80 shrink-0 glass rounded-2xl flex flex-col overflow-hidden">
          <div className="p-3 border-b border-slate-800/80">
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Search messages..."
                className="w-full h-9 px-3 rounded-lg bg-slate-800/50 border border-slate-700/50 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-violet-500/50 transition-all"
              />
            </div>
            <div className="flex items-center gap-2 mt-2">
              {(["facebook", "instagram", "tiktok", "youtube"] as Platform[]).map((p) => {
                const Icon = platformIcons[p];
                return (
                  <div key={p} className="p-1.5 rounded-lg bg-slate-800/40 hover:bg-slate-700/40 transition-colors cursor-pointer" title={platformLabels[p]}>
                    <Icon className={`w-3.5 h-3.5 ${platformColor[p]}`} />
                  </div>
                );
              })}
              <span className="text-[10px] text-slate-500 ml-auto">All channels</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-thin">
            {messages.map((msg) => {
              const Icon = platformIcons[msg.platform];
              const active = msg.id === selectedId;
              return (
                <button
                  key={msg.id}
                  onClick={() => handleSelect(msg)}
                  className={`w-full flex items-start gap-3 p-3 border-b border-slate-800/40 transition-all text-left ${
                    active ? "bg-violet-500/10 border-l-2 border-l-violet-500" : "hover:bg-slate-800/40 border-l-2 border-l-transparent"
                  }`}
                >
                  <div className={`relative w-10 h-10 rounded-full bg-gradient-to-br ${msg.avatarColor} flex items-center justify-center shrink-0`}>
                    <span className="text-xs font-bold text-white">
                      {msg.sender.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                    </span>
                    <div className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-slate-900 flex items-center justify-center`}>
                      <Icon className={`w-2.5 h-2.5 ${platformColor[msg.platform]}`} />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-sm truncate ${msg.unread ? "font-bold text-white" : "font-medium text-slate-300"}`}>
                        {msg.sender}
                      </p>
                      <span className="text-[10px] text-slate-500 shrink-0">{msg.timestamp}</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
                        msg.type === "dm" ? "bg-violet-500/15 text-violet-300" : "bg-blue-500/15 text-blue-300"
                      }`}>
                        {msg.type === "dm" ? "DM" : "Comment"}
                      </span>
                      <p className="text-xs text-slate-500 truncate">{msg.message}</p>
                    </div>
                  </div>
                  {msg.unread && <span className="w-2 h-2 rounded-full bg-violet-400 shrink-0 animate-pulse" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Chat view */}
        <div className="flex-1 glass rounded-2xl flex flex-col overflow-hidden">
          {/* Chat header */}
          <div className="flex items-center gap-3 p-4 border-b border-slate-800/80">
            <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${selected.avatarColor} flex items-center justify-center shrink-0`}>
              <span className="text-xs font-bold text-white">
                {selected.sender.split(" ").map((n) => n[0]).join("").slice(0, 2)}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white">{selected.sender}</p>
              <p className="text-xs text-slate-500">{selected.senderHandle}</p>
            </div>
            <div className="flex items-center gap-2">
              {(() => {
                const Icon = platformIcons[selected.platform];
                return (
                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800/50">
                    <Icon className={`w-3.5 h-3.5 ${platformColor[selected.platform]}`} />
                    <span className="text-xs font-medium text-slate-300">{platformLabels[selected.platform]}</span>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-4">
            {/* Incoming message */}
            <div className="flex items-start gap-3 max-w-[80%]">
              <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${selected.avatarColor} flex items-center justify-center shrink-0`}>
                <span className="text-[10px] font-bold text-white">
                  {selected.sender.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                </span>
              </div>
              <div>
                <div className="bg-slate-800/60 rounded-2xl rounded-tl-sm p-3.5">
                  <p className="text-sm text-slate-200 leading-relaxed">{selected.message}</p>
                </div>
                <p className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {selected.timestamp}
                </p>
              </div>
            </div>

            {/* AI suggested reply banner */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-violet-500/10 border border-violet-500/20">
              <Bot className="w-4 h-4 text-violet-400 shrink-0" />
              <p className="text-xs text-violet-300 font-medium">
                AI Auto-Pilot {autoPilot ? "drafted" : "suggested"} a reply. {autoPilot ? "It will auto-send in 30s." : "Review and send manually."}
              </p>
            </div>
          </div>

          {/* Reply composer */}
          <div className="p-4 border-t border-slate-800/80 space-y-3">
            <div className="rounded-xl bg-slate-800/50 border border-slate-700/50 focus-within:border-violet-500/50 transition-all">
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Type your reply or use AI suggestion..."
                rows={3}
                className="w-full px-4 py-3 bg-transparent text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none resize-none"
              />
              <div className="flex items-center justify-between px-3 pb-3">
                <div className="flex items-center gap-2">
                  <button className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-violet-500/15 text-violet-300 text-xs font-medium hover:bg-violet-500/25 transition-colors">
                    <Bot className="w-3.5 h-3.5" />
                    Regenerate AI Reply
                  </button>
                  <button className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-slate-400 text-xs font-medium hover:bg-slate-700/40 transition-colors">
                    <Edit3 className="w-3.5 h-3.5" />
                    Edit
                  </button>
                </div>
                <button
                  onClick={handleSend}
                  disabled={!replyText.trim()}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-sm font-semibold text-white hover:from-violet-500 hover:to-indigo-500 transition-all disabled:opacity-40 disabled:cursor-not-allowed glow-purple"
                >
                  <Send className="w-4 h-4" />
                  Send
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
