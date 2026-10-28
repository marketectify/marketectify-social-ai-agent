# Setup guide: turn on accounts and saving (Supabase)

The site works without any of this. Until you finish these steps it runs in **demo mode**:
there is no login and posts are saved only in the visitor's own browser.

After the steps below, people can sign up and sign in, and every workspace gets its own
private calendar saved in a real database.

You need about 15 minutes. Everything here is free to start.

---

## 1. Create the Supabase project

1. Go to <https://supabase.com> and sign in (GitHub login is fine).
2. Click **New project**. Pick a name (for example `marketectify`), set a strong database
   password (save it in a password manager) and choose the region closest to your users.
3. Wait about two minutes until the project is ready.

## 2. Create the tables

1. In the left menu open **SQL Editor** and click **New query**.
2. Open the file `supabase/migrations/0001_init.sql` from this repository, copy **all** of it
   and paste it into the editor.
3. Click **Run**. You should see "Success. No rows returned".

This creates the `workspaces` and `posts` tables and the security rules (row level security).
The rules make sure one account can never see or change another account's data.

## 3. Tell Supabase where your site lives

Open **Authentication → URL Configuration** and set:

- **Site URL:** `https://social-ai.marketectify.com`
- **Redirect URLs:** add `https://social-ai.marketectify.com` (add `http://localhost:5173`
  too if you want to test on your own computer)

This is needed so the links in confirmation and password-reset emails open your site.

**Email confirmation:** under **Authentication → Providers → Email** you can keep
"Confirm email" on (recommended for a live site) or turn it off while testing.

> Supabase's built-in email sender is limited to a few emails per hour. That is fine for
> testing. Before you invite many users, connect your own email service under
> **Authentication → SMTP Settings** (for example your Hostinger mailbox or Resend).

## 4. Copy the two public keys

Open **Project Settings → API** and copy:

- **Project URL** (looks like `https://abcdxyz.supabase.co`)
- **anon public** key

These two values are designed to be public and are safe in the browser. The security comes
from the rules in step 2.

> **Never** use or share the `service_role` key, and never put it in this project. It
> bypasses all security.

## 5. Add the keys to GitHub

1. In this repository open **Settings → Secrets and variables → Actions**.
2. Click **New repository secret** and add:
   - Name `VITE_SUPABASE_URL` → the Project URL
   - Name `VITE_SUPABASE_ANON_KEY` → the anon public key
3. Open the **Actions** tab, choose **Publish site to deploy branch** and click
   **Run workflow**.

The workflow builds the site with your keys and publishes it to the `deploy` branch.

## 6. Make Hostinger use the `deploy` branch

In Hostinger open the website → **Deployments** (the GitHub connection) and make sure it
deploys the **`deploy`** branch with the root directory **`public_html`**. Then press
**Redeploy**.

Important: the files committed in `dist/` on `main` are built **without** your keys, so a
site served from them stays in demo mode. Only the `deploy` branch has the keys built in.

## 7. Try it

1. Open <https://social-ai.marketectify.com>. You should see a sign-in page instead of the
   yellow "Demo mode" banner.
2. Click **Create an account**, confirm the email if asked, and sign in.
3. Open **Calendar & Approvals** and create a post. Refresh the page: it is still there.

If you see "We couldn't load your workspace", step 2 (the SQL script) was not run.

---

## Local development

```bash
npm install
cp .env.example .env.local   # then put your two values in it
npm run dev                  # http://localhost:5173
npm test                     # unit tests
npm run build                # type-check and production build
```

Without `.env.local` the app starts in demo mode.

## What comes next (not built yet)

| Feature | What you will need |
| --- | --- |
| AI captions, hashtags, reel scripts | A **Google Gemini API key** from <https://aistudio.google.com/apikey>. It is stored as a secret inside Supabase and called from a server function, so it never reaches the browser. |
| AI reply drafts in the Inbox | The same Gemini key |
| Publishing to Facebook and Instagram | A Meta developer app, a Facebook Page linked to an Instagram professional account, and Meta app review for the publishing permissions |
| Publishing to TikTok | A TikTok developer app and approval for the Content Posting API |
| Publishing to YouTube | A Google Cloud project with the YouTube Data API v3 and OAuth consent verification |
| Receiving real DMs and comments | The same developer apps and their webhooks |

The platform approvals can take days or weeks, so it is worth starting those applications early.
