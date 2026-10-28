# Marketectify AI Social Agent

A dashboard for planning, approving and scheduling social media content for Facebook,
Instagram, TikTok and YouTube, with AI assistance.

Built with React, TypeScript, Vite and Tailwind CSS. Accounts and data use Supabase.

## What works today

- Sign up, sign in, password reset (when Supabase is connected)
- Content calendar with month and week views
- Create, edit, approve, schedule and delete posts, saved per workspace
- Dashboard numbers calculated from your real posts
- Light and dark themes

## Still sample data (marked on screen)

AI Content Studio, Unified Inbox and Analytics show example content. They are being
connected to real data step by step.

## Getting started

See [docs/SETUP.md](docs/SETUP.md) to connect the database and go live.

```bash
npm install
npm run dev
npm test
npm run build
```

Without a `.env.local` file the app runs in demo mode (no login, data saved in the browser).

## Deployment

Every push to `main` builds the site and publishes the finished files to the `deploy`
branch (see `.github/workflows/publish-site.yml`). Hostinger deploys that branch.
