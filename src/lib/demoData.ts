import type { Post } from "../types";
import { addDays, atHour } from "./dates";

/**
 * Sample posts for demo mode. Dates are relative to "now", so the demo always
 * looks current instead of showing a stale month.
 */
export function demoPosts(now: Date): Post[] {
  const at = (dayOffset: number, hour: number, minute = 0) => {
    const d = atHour(addDays(now, dayOffset), hour);
    d.setMinutes(minute);
    return d.toISOString();
  };

  return [
    {
      id: "demo-1",
      title: "Industry News Roundup",
      caption:
        "This week in AI and social media: the latest trends, updates, and what they mean for your brand. 📰",
      hashtags: ["#AI", "#News", "#WeeklyRoundup"],
      platforms: ["facebook", "instagram"],
      status: "published",
      scheduledAt: at(-2, 15),
    },
    {
      id: "demo-2",
      title: "Product Launch Teaser",
      caption: "Something big is coming... Get ready for the future of AI automation! 🚀",
      hashtags: ["#AI", "#ProductLaunch", "#Marketectify"],
      platforms: ["instagram", "tiktok", "youtube"],
      status: "approved",
      scheduledAt: at(1, 10),
    },
    {
      id: "demo-3",
      title: "Behind the Scenes: Team Spotlight",
      caption:
        "Meet the brilliant minds behind Marketectify AI! Our engineering team shares their vision. ✨",
      hashtags: ["#BehindTheScenes", "#TeamSpotlight"],
      platforms: ["facebook", "instagram"],
      status: "pending",
      scheduledAt: at(2, 14),
    },
    {
      id: "demo-4",
      title: "Customer Success Story",
      caption:
        "How one client scaled their social presence 10x with Marketectify AI. Full case study dropping soon! 📊",
      hashtags: ["#SuccessStory", "#CaseStudy", "#Growth"],
      platforms: ["facebook", "instagram", "tiktok", "youtube"],
      status: "pending",
      scheduledAt: at(3, 11, 30),
    },
    {
      id: "demo-5",
      title: "Quick Tip: 3 AI Hacks for Reels",
      caption:
        "Want your Reels to go viral? Here are 3 AI-powered hacks that actually work. Save this post! 🔥",
      hashtags: ["#ReelsTips", "#AIHacks", "#ViralContent"],
      platforms: ["instagram", "tiktok", "youtube"],
      status: "approved",
      scheduledAt: at(4, 9),
    },
    {
      id: "demo-6",
      title: "Flash Sale — 48 Hours Only",
      caption:
        "Flash sale! Get 40% off Marketectify Pro for the next 48 hours. Don't miss out! ⚡",
      hashtags: ["#FlashSale", "#Discount", "#LimitedTime"],
      platforms: ["facebook", "instagram", "tiktok", "youtube"],
      status: "approved",
      scheduledAt: at(6, 8),
    },
    {
      id: "demo-7",
      title: "Webinar Announcement: AI for SMBs",
      caption:
        "Join our free webinar on how small businesses can leverage AI for explosive social growth. Register now! 🎓",
      hashtags: ["#Webinar", "#SMB", "#AIEducation"],
      platforms: ["facebook", "youtube"],
      status: "draft",
      scheduledAt: null,
    },
  ];
}
