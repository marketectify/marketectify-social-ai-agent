import type {
  ScheduledPost,
  InboxMessage,
  StatCard,
  Platform,
} from "./types";

export const platformLabels: Record<Platform, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
};

export const platformColors: Record<Platform, string> = {
  facebook: "text-blue-600",
  instagram: "text-pink-400",
  tiktok: "text-cyan-300",
  youtube: "text-red-400",
};

export const platformBg: Record<Platform, string> = {
  facebook: "bg-blue-500/10 border-blue-500/30",
  instagram: "bg-pink-500/10 border-pink-500/30",
  tiktok: "bg-cyan-500/10 border-cyan-500/30",
  youtube: "bg-red-500/10 border-red-500/30",
};

export const statCards: StatCard[] = [
  {
    label: "Total Reach / Views",
    value: "2.4M",
    trend: "+14.5%",
    trendUp: true,
    icon: "Eye",
    gradient: "from-blue-500/20 to-sky-500/10",
  },
  {
    label: "Total Followers",
    value: "184.2K",
    trend: "+8.3%",
    trendUp: true,
    icon: "Users",
    gradient: "from-blue-500/20 to-cyan-500/10",
  },
  {
    label: "Engagement Rate",
    value: "7.8%",
    trend: "+2.1%",
    trendUp: true,
    icon: "Heart",
    gradient: "from-pink-500/20 to-rose-500/10",
  },
  {
    label: "Leads Generated",
    value: "1,247",
    trend: "+22.7%",
    trendUp: true,
    icon: "Target",
    gradient: "from-emerald-500/20 to-teal-500/10",
  },
];

export const upcomingPosts: ScheduledPost[] = [
  {
    id: "p1",
    title: "Product Launch Teaser",
    caption: "Something big is coming... Get ready for the future of AI automation! 🚀",
    date: "Oct 23",
    time: "10:00 AM",
    platforms: ["instagram", "tiktok", "youtube"],
    status: "approved",
    thumbnailGradient: "from-blue-600 to-sky-600",
    hashtags: ["#AI", "#ProductLaunch", "#Marketectify"],
  },
  {
    id: "p2",
    title: "Behind the Scenes: Team Spotlight",
    caption: "Meet the brilliant minds behind Marketectify AI! Our engineering team shares their vision. ✨",
    date: "Oct 24",
    time: "2:00 PM",
    platforms: ["facebook", "instagram"],
    status: "pending",
    thumbnailGradient: "from-blue-600 to-cyan-600",
    hashtags: ["#BehindTheScenes", "#TeamSpotlight"],
  },
  {
    id: "p3",
    title: "Customer Success Story — TechFlow",
    caption: "How TechFlow scaled their social presence 10x with Marketectify AI. Full case study dropping soon! 📊",
    date: "Oct 25",
    time: "11:30 AM",
    platforms: ["facebook", "instagram", "tiktok", "youtube"],
    status: "pending",
    thumbnailGradient: "from-emerald-600 to-teal-600",
    hashtags: ["#SuccessStory", "#CaseStudy", "#Growth"],
  },
  {
    id: "p4",
    title: "Quick Tip: 3 AI Hacks for Reels",
    caption: "Want your Reels to go viral? Here are 3 AI-powered hacks that actually work. Save this post! 🔥",
    date: "Oct 26",
    time: "9:00 AM",
    platforms: ["instagram", "tiktok", "youtube"],
    status: "approved",
    thumbnailGradient: "from-amber-600 to-orange-600",
    hashtags: ["#ReelsTips", "#AIHacks", "#ViralContent"],
  },
];

export const calendarPosts: ScheduledPost[] = [
  ...upcomingPosts,
  {
    id: "c1",
    title: "Industry News Roundup",
    caption: "This week in AI and social media: the latest trends, updates, and what they mean for your brand. 📰",
    date: "Oct 22",
    time: "3:00 PM",
    platforms: ["facebook", "instagram"],
    status: "published",
    thumbnailGradient: "from-slate-600 to-slate-700",
    hashtags: ["#AI", "#News", "#WeeklyRoundup"],
  },
  {
    id: "c2",
    title: "Flash Sale — 48 Hours Only",
    caption: "Flash sale! Get 40% off Marketectify Pro for the next 48 hours. Don't miss out! ⚡",
    date: "Oct 28",
    time: "8:00 AM",
    platforms: ["facebook", "instagram", "tiktok", "youtube"],
    status: "approved",
    thumbnailGradient: "from-red-600 to-pink-600",
    hashtags: ["#FlashSale", "#Discount", "#LimitedTime"],
  },
  {
    id: "c3",
    title: "Webinar Announcement: AI for SMBs",
    caption: "Join our free webinar on how small businesses can leverage AI for explosive social growth. Register now! 🎓",
    date: "Oct 30",
    time: "1:00 PM",
    platforms: ["facebook", "youtube"],
    status: "pending",
    thumbnailGradient: "from-sky-600 to-purple-600",
    hashtags: ["#Webinar", "#SMB", "#AIEducation"],
  },
  {
    id: "c4",
    title: "Halloween Themed Post",
    caption: "Spooky good deals this Halloween! 🎃 AI-powered content that's frighteningly effective.",
    date: "Oct 31",
    time: "5:00 PM",
    platforms: ["instagram", "tiktok", "youtube"],
    status: "pending",
    thumbnailGradient: "from-purple-600 to-blue-700",
    hashtags: ["#Halloween", "#SpookySeason", "#AIDeals"],
  },
  {
    id: "c5",
    title: "Monthly Performance Recap",
    caption: "October recap: We hit 1M+ impressions! Here's a breakdown of what worked. 📈",
    date: "Oct 31",
    time: "10:00 AM",
    platforms: ["facebook", "instagram", "tiktok", "youtube"],
    status: "approved",
    thumbnailGradient: "from-teal-600 to-cyan-700",
    hashtags: ["#MonthlyRecap", "#Analytics", "#Growth"],
  },
];

export const inboxMessages: InboxMessage[] = [
  {
    id: "m1",
    platform: "instagram",
    sender: "Sarah Chen",
    senderHandle: "@sarahcreative",
    avatarColor: "from-pink-500 to-rose-500",
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
    avatarColor: "from-cyan-500 to-blue-500",
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
    avatarColor: "from-blue-500 to-sky-500",
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
    avatarColor: "from-red-500 to-orange-500",
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
    avatarColor: "from-blue-500 to-purple-500",
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
    avatarColor: "from-teal-500 to-emerald-500",
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
