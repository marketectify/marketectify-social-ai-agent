import type { InboxMessage, Platform } from "./types";

export const platformLabels: Record<Platform, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
};

export const platformColors: Record<Platform, string> = {
  facebook: "text-blue-600 dark:text-blue-400",
  instagram: "text-pink-600 dark:text-pink-400",
  tiktok: "text-cyan-700 dark:text-cyan-300",
  youtube: "text-red-600 dark:text-red-400",
};

export const platformBg: Record<Platform, string> = {
  facebook: "bg-blue-500/10 border-blue-500/30",
  instagram: "bg-pink-500/10 border-pink-500/30",
  tiktok: "bg-cyan-500/10 border-cyan-500/30",
  youtube: "bg-red-500/10 border-red-500/30",
};

export const inboxMessages: InboxMessage[] = [
  {
    id: "m1",
    platform: "instagram",
    sender: "Sarah Chen",
    senderHandle: "@sarahcreative",
    avatarColor: "bg-pink-600",
    message: "Love your content! How can I get started with Marketectify for my agency?",
    timestamp: "2 min ago",
    unread: true,
    type: "dm",
    aiSuggestedReply:
      "Hi Sarah! Thanks so much for the love! 🙏 You can start your free trial at marketectify.ai/signup — it takes under 2 minutes to set up. Would you like me to share a quick onboarding guide tailored for agencies?",
  },
  {
    id: "m2",
    platform: "tiktok",
    sender: "Mike Rivera",
    senderHandle: "@mikebuilds",
    avatarColor: "bg-cyan-700",
    message: "This AI tool is insane! Does it support scheduling for multiple clients?",
    timestamp: "15 min ago",
    unread: true,
    type: "comment",
    aiSuggestedReply:
      "Hey Mike! Absolutely — Marketectify Pro supports unlimited client workspaces with separate calendars, analytics, and approval flows. You can switch between client accounts in one click. Let me know if you'd like a demo! 🚀",
  },
  {
    id: "m3",
    platform: "facebook",
    sender: "Jessica Park",
    senderHandle: "Jessica Park",
    avatarColor: "bg-blue-600",
    message: "What's the pricing for the enterprise plan? We have a team of 20+",
    timestamp: "1 hour ago",
    unread: false,
    type: "dm",
    aiSuggestedReply:
      "Hi Jessica! Our Enterprise plan starts at $499/mo and includes 25 seats, dedicated support, custom AI training, and white-label options. I'd be happy to schedule a call with our team to discuss your needs. Would Thursday work?",
  },
  {
    id: "m4",
    platform: "youtube",
    sender: "David Kumar",
    senderHandle: "@davidtechreview",
    avatarColor: "bg-red-600",
    message: "Great video! Can the AI generate content in Spanish?",
    timestamp: "3 hours ago",
    unread: false,
    type: "comment",
    aiSuggestedReply:
      "Thanks David! Yes — Marketectify AI supports 30+ languages including Spanish, French, German, Hindi, and more. You can select your target language in the Content Studio before generating. ¡Estamos aquí para ayudarte! 🌍",
  },
  {
    id: "m5",
    platform: "instagram",
    sender: "Emily Watson",
    senderHandle: "@emilydesigns",
    avatarColor: "bg-indigo-600",
    message: "Just signed up! The reel generation feature is a game changer 🔥",
    timestamp: "5 hours ago",
    unread: false,
    type: "comment",
    aiSuggestedReply:
      "Welcome to Marketectify, Emily! 🎉 So glad you're loving the Reel generator. If you ever need tips or have feedback, our team is always here. Happy creating! ✨",
  },
  {
    id: "m6",
    platform: "tiktok",
    sender: "Alex Foster",
    senderHandle: "@alexfosterbiz",
    avatarColor: "bg-teal-700",
    message: "Do you offer integrations with HubSpot?",
    timestamp: "8 hours ago",
    unread: false,
    type: "dm",
    aiSuggestedReply:
      "Hi Alex! Yes, we have a native HubSpot integration that syncs leads captured through AI DMs directly into your CRM. You can connect it from Settings > Integrations. Need help setting it up?",
  },
];

export const engagementData = [
  { platform: "Facebook", value: 82, color: "bg-blue-500", reach: "640K", engagement: "6.2%" },
  { platform: "Instagram", value: 95, color: "bg-pink-500", reach: "980K", engagement: "8.9%" },
  { platform: "TikTok", value: 78, color: "bg-cyan-400", reach: "1.2M", engagement: "9.5%" },
  { platform: "YouTube", value: 65, color: "bg-red-500", reach: "420K", engagement: "5.1%" },
];

export const monthlyChartData = [
  { month: "May", facebook: 45, instagram: 60, tiktok: 55, youtube: 30 },
  { month: "Jun", facebook: 52, instagram: 68, tiktok: 70, youtube: 35 },
  { month: "Jul", facebook: 48, instagram: 75, tiktok: 85, youtube: 40 },
  { month: "Aug", facebook: 60, instagram: 82, tiktok: 90, youtube: 48 },
  { month: "Sep", facebook: 65, instagram: 88, tiktok: 95, youtube: 52 },
  { month: "Oct", facebook: 72, instagram: 95, tiktok: 100, youtube: 58 },
];

export const leadFunnelData = [
  { stage: "AI DMs Sent", count: 8420, percentage: 100 },
  { stage: "Leads Captured", count: 1247, percentage: 15 },
  { stage: "Qualified Leads", count: 683, percentage: 8 },
  { stage: "Converted", count: 214, percentage: 2.5 },
];
