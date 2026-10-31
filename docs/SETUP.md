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

## 8. Turn on the AI Content Studio (Google Gemini)

The Studio writes captions, hashtags, reel scripts and visual ideas with Google Gemini.
The Gemini key is stored **only inside Supabase** as a secret. It is never put in GitHub,
never in the website code and never sent to the browser.

1. **Daily limit table.** SQL Editor, New query, paste all of `supabase/migrations/0002_ai_quota.sql`, Run.
   This stops one account from using up your Gemini budget (default 60 generations per account per day).
2. **Get a key** at <https://aistudio.google.com/apikey> (Create API key).
3. **Save it as a secret.** Supabase dashboard, **Edge Functions**, **Secrets**, add:
   - `GEMINI_API_KEY` = your key (required)
   - `GEMINI_MODEL` = optional, one model name or a comma separated list tried in order
     (default `gemini-3.5-flash-lite,gemini-3.6-flash,gemini-2.5-flash`)
   - `AI_DAILY_LIMIT` = optional, generations per account per day (default 60)
4. **Deploy the function.** Two ways:
   - Automatic: in GitHub, Settings, Secrets and variables, Actions, add `SUPABASE_ACCESS_TOKEN`
     (Supabase, Account, Access Tokens) and `SUPABASE_PROJECT_REF` (the part of your project URL
     before `.supabase.co`). The workflow *Deploy Supabase functions* then deploys on every merge
     to `main` that changes `supabase/functions`, and you can also run it by hand from the Actions tab.
   - Manual: install the Supabase CLI, then
     `supabase functions deploy generate-content --project-ref YOUR_REF` and
     `supabase secrets set GEMINI_API_KEY=...`.
5. Sign in, open **AI Content Studio**, write a topic and press **Captions & hashtags**.

If you pasted the key anywhere public (a chat, a screenshot, a commit), create a new key in
Google AI Studio, delete the old one and update the secret.

### Troubleshooting the Studio

| Message | Fix |
| --- | --- |
| "The AI is not set up yet" | `GEMINI_API_KEY` secret is missing, or the function was not redeployed after adding it |
| "The AI key was rejected" | The key is wrong, deleted or restricted. Create a new one |
| "None of the configured AI models is available" | Set `GEMINI_MODEL` to a model listed in Google AI Studio, for example `gemini-2.5-flash` |
| "daily limit table is missing" | Run `0002_ai_quota.sql` (step 1) |
| "Not signed in" / 401 | Sign out and in again. The function checks your login on every call |
| Function not found (404) | The function is not deployed yet (step 4) |

## 9. Turn on the Inbox

SQL Editor, New query, paste all of `supabase/migrations/0003_messages.sql`, Run. That is all.
The Inbox uses the same Gemini key and daily limit as the Studio, so nothing else is needed.

Until Facebook, Instagram, TikTok and YouTube are connected (they need app review by each platform),
messages are added by hand with **Add message**. The AI drafts the reply, you copy it, post it on the
platform and press **Mark as replied**.

## 10. Turn on Analytics and Leads

SQL Editor, New query, paste all of `supabase/migrations/0004_message_leads.sql`, Run.

Analytics is calculated from your own posts and messages (published, scheduled, reply rate, average reply
time, leads, posts per month, CSV export). In the Inbox press **Mark as lead** on messages from potential
customers and the lead funnel fills in. Reach, likes and followers only exist inside Facebook, Instagram,
TikTok and YouTube, so they will appear after those connections are built, not before.

## Design Studio

Open **Design Studio**, drag a heading, paragraph, box, circle or picture onto the canvas (or drop a picture file
from your computer), pick a background (colour, blend or picture) and press **Download PNG** or **Use in post**.

- **Many designs:** **Save** keeps the design; **New design** starts a fresh canvas; **Save as copy** makes a second
  design from the one you have open. Every saved design appears under **My designs** and you can open any of them.
  Picking a template while a saved design is open starts a new design, so the saved one is never overwritten.
- **Use in post:** turns the design into a picture and opens the post form with it attached. Choose platforms and a
  date, then **Send for approval** or **Approve & schedule** like any other post. The picture shows in the Calendar.
- Designs you press **Save** on are kept in the browser on that computer. They are not in the database yet, so they
  do not follow you to another computer. A design you send to a post is stored with the post and is safe.

### Run `0008_post_media.sql` (needed for "Use in post" in real mode)

Supabase -> SQL Editor -> paste `supabase/migrations/0008_post_media.sql` -> Run. It adds the picture columns to
posts and creates the public storage bucket `post-media` (only the workspace owner can add or delete files in
their own folder). In demo mode pictures are kept in the browser instead.

### AI pictures (paid Gemini feature)

The **AI picture** box in the Design Studio makes a picture from a description. Run `0007_media_quota.sql` once
(its own small daily limit, default 10 pictures per user per day, secret `AI_IMAGE_DAILY_LIMIT`). Picture models are
paid: billing must be on for the Google project that owns `GEMINI_API_KEY`. The model list can be changed with the
optional secret `GEMINI_IMAGE_MODEL`. The function `generate-image` is deployed by the same GitHub Action.

## Help assistant

The round **Help** button at the bottom right of every page opens a chat that answers questions about this app
(how to use each tab, what secrets are needed, what to do on an error). It uses the same `GEMINI_API_KEY` as the AI
Studio and the same daily limit, so there is nothing new to set up. It only works when signed in (not in demo mode).
The function is `help-assistant`; it is deployed by the same GitHub Action as the other functions.
Its knowledge lives in `supabase/functions/help-assistant/logic.ts` (`APP_GUIDE`): when you add a feature, add a line there.

## Hostinger by FTP (if the GitHub connection breaks)

Hostinger can lose its GitHub link (for example when a second GitHub account is connected to the same Hostinger
account). The site can then be uploaded by FTP instead, straight from GitHub Actions:

1. Hostinger -> Websites -> your site -> **Files -> FTP Accounts**. Note the **host**, **username**, and the **folder**
   (usually `/domains/<your-domain>/public_html/`). Set or reset the FTP password there.
2. GitHub -> repository -> Settings -> Secrets and variables -> Actions -> **Repository secrets**. Add
   `FTP_SERVER` (the host), `FTP_USERNAME`, `FTP_PASSWORD` and `FTP_DIR` (the folder, ending with `/`).
3. Merge any pull request (or run **Publish site to deploy branch** by hand). The action uploads the built site.

If the FTP secrets are missing the step is skipped. Never share the FTP password in chat.

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
| AI reply drafts in the Inbox | The same Gemini key |
| Publishing to Facebook and Instagram | A Meta developer app, a Facebook Page linked to an Instagram professional account, and Meta app review for the publishing permissions |
| Publishing to TikTok | A TikTok developer app and approval for the Content Posting API |
| Publishing to YouTube | A Google Cloud project with the YouTube Data API v3 and OAuth consent verification |
| Receiving real DMs and comments automatically, and sending replies | The same developer apps and their webhooks (today messages are added by hand) |

The platform approvals can take days or weeks, so it is worth starting those applications early.
