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

**Auto-draft replies:** switch it on at the top of the Inbox. The AI then writes a first reply (up to 5 at a time, 1 AI use each) for new messages, shown with a "Draft ready" badge. You still check and post the reply yourself. **Posting by hand:** open an approved post and use *Copy caption*, *Download picture* and *Mark as published*. Real automatic posting and replying on Facebook, Instagram and TikTok needs each platform's developer app and approval, and is a separate step.

Until Facebook, Instagram, TikTok and YouTube are connected (they need app review by each platform),
messages are added by hand with **Add message**. The AI drafts the reply, you copy it, post it on the
platform and press **Mark as replied**.

## 10. Turn on Analytics and Leads

SQL Editor, New query, paste all of `supabase/migrations/0004_message_leads.sql`, Run.

Analytics is calculated from your own posts and messages (published, scheduled, reply rate, average reply
time, leads, posts per month, CSV export). In the Inbox press **Mark as lead** on messages from potential
customers and the lead funnel fills in. Reach, likes and followers only exist inside Facebook, Instagram,
TikTok and YouTube, so they will appear after those connections are built, not before.

## 11. Connect YouTube

Connecting shows your channel name and real subscriber, view and video counts in the top bar and in
Analytics. (Publishing videos comes later: it needs a video upload feature.)

**Google Cloud (free)**
1. <https://console.cloud.google.com>, create a project, then **APIs & Services, Library**, enable **YouTube Data API v3**.
2. **OAuth consent screen**: user type External, app name, your email. Add your own Gmail under **Test users**.
3. **Credentials, Create credentials, OAuth client ID**, type **Web application**. Under
   **Authorized redirect URIs** add `https://YOUR-PROJECT-REF.supabase.co/functions/v1/youtube-callback`.
4. Copy the Client ID and Client secret.

**Supabase**
1. SQL Editor: run `supabase/migrations/0005_social_accounts.sql`.
2. Edge Functions, Secrets, add:
   - `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` (from step 4)
   - `OAUTH_STATE_SECRET` = any long random text (30+ characters)
   - `SITE_URL` = `https://social-ai.marketectify.com`
3. Deploy the functions: merge to `main` (the deploy workflow now deploys `youtube-auth`, `youtube-callback`
   and `youtube-refresh` too), or run the workflow by hand from the Actions tab.
4. Open the site, press **Connect** next to YouTube in the top bar, choose your Google account, allow access.

While the Google app is in "Testing" mode only the listed test users can connect, and Google makes the
login expire after 7 days (press Connect again). For other people's channels the app needs Google verification.
The login tokens are stored in the database but can never be read from the browser, only by the server functions.

| Message | Fix |
| --- | --- |
| "YouTube is not set up" | A Google secret is missing, or the functions were not redeployed |
| Google says "redirect_uri_mismatch" | The redirect URI in Google Cloud must match exactly step 3 above |
| Google says "access blocked" | Add your Gmail under Test users on the OAuth consent screen |
| "YouTube Data API v3 is not enabled" | Enable it in Google Cloud, Library |
| "no YouTube channel" | Create a channel on youtube.com with that Google account |

## 12. Connect Facebook and Instagram

After this, the **Connect** buttons next to Facebook and Instagram in the top bar work, approved posts are **published
automatically** at their time, new comments arrive in the **Inbox**, and you can **send the reply** straight to the comment.

**You need:** a Facebook **Page** you are admin of, and (for Instagram) an Instagram **Business or Creator** account linked to
that Page. A personal Instagram account cannot be used.

**A. Database.** Supabase, SQL Editor: run `supabase/migrations/0011_meta.sql` (it needs 0003, 0005 and 0008 first).

**B. Meta app** (free) at <https://developers.facebook.com>. Meta changes this dashboard often, so names may differ a little.
1. Log in with the Facebook account that is admin of the Page. **My Apps, Create app**, name `Marketectify Social`, add your email.
2. Choose the use cases **Manage everything on your Page** and **Manage messaging and content on Instagram**.
3. In each use case press **Customize** and add these permissions, then **Ready to test**:
   `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`, `pages_manage_engagement`,
   `instagram_basic`, `instagram_content_publish`, `instagram_manage_comments`.
4. **Facebook Login (for Business), Settings**: add this to **Valid OAuth Redirect URIs**:
   `https://YOUR-PROJECT-REF.supabase.co/functions/v1/meta-callback`
5. **App settings, Basic**: copy the **App ID** and **App secret** (press Show). Fill in the fields Meta asks for:
   Privacy Policy URL `https://social-ai.marketectify.com/privacy.html`, Terms of Service URL
   `https://social-ai.marketectify.com/terms.html`, Data deletion instructions URL
   `https://social-ai.marketectify.com/data-deletion.html`, an app icon and a category.
6. Only if your app uses **Facebook Login for Business**: open **Facebook Login for Business, Configurations**, create a
   configuration with token type **User access token** and the permissions from step 3, and copy its **Configuration ID**.
7. Leave the app in **Development mode**. In **App roles** make sure you are an Admin. In Development mode the app works for
   everyone who has a role on it (Admin, Developer, Tester), with no Meta review. Add each other person who should connect
   as a **Tester** (they must accept the invitation on Facebook).

**C. Supabase secrets** (Edge Functions, Secrets). `OAUTH_STATE_SECRET` and `SITE_URL` are already there from YouTube. Add:
- `META_APP_ID` and `META_APP_SECRET` (step 5)
- `CRON_SECRET` = any long random text (30+ characters)
- `META_LOGIN_CONFIG_ID` = the Configuration ID (only if you did step 6)

**D. Deploy the functions:** GitHub, **Actions, Deploy Supabase functions, Run workflow**. Wait for the green tick.

**E. The 5-minute scheduler.** GitHub, repository **Settings, Secrets and variables, Actions, New repository secret**:
`META_CRON_SECRET` = exactly the same text as `CRON_SECRET`. The workflow **Publish due posts (Facebook and Instagram)** then
runs every 5 minutes (GitHub can delay it a few minutes). Test it once: **Actions, that workflow, Run workflow**; the log
should say `meta-cron answered 200`.

**F. On the site:** Redeploy on Hostinger, press Ctrl+Shift+R, then **Connect** next to Facebook, choose your Page and the
Instagram account, and allow everything it asks for.

**How it behaves**
- One Page (the first one that has an Instagram account, otherwise the first Page) is connected per workspace.
- Approve a post with Facebook and/or Instagram selected. At its time the server publishes it. Open the post to see the
  result. **Publish now** sends it immediately. If a try fails, the reason is shown on the post and it is **not** retried by
  itself: fix the cause (for example, add a picture), then press **Publish now**.
- **Instagram needs a picture** (a text-only post is refused). Pictures you upload are converted to JPEG, which Instagram requires,
  and Instagram only accepts shapes between 4:5 (tall) and 1.91:1 (wide).
- A post that also has TikTok or YouTube is not marked published automatically: post those by hand, then press **Mark as published**.
- Comments: the Inbox checks when you open it and every 5 minutes (the latest 10 posts, 25 comments each). **Auto-draft replies**
  then writes the first answer. Direct messages (DMs) are not included: Meta requires an extra approval for those.
- Disconnect in the top bar removes the saved login from the database.

**For other people's Pages (customers):** Development mode only works for people with a role on your app. For the public you need
**App Review** for each permission and usually **Business Verification** (company documents) in Meta's App Dashboard, plus
the Privacy Policy and data deletion pages above. This takes days to weeks.

| Message | Fix |
| --- | --- |
| "Facebook and Instagram are not set up yet" | `META_APP_ID`, `META_APP_SECRET` or `OAUTH_STATE_SECRET` is missing, or the functions were not redeployed |
| Facebook says "Feature unavailable" or "Invalid scopes" | The app uses Facebook Login for Business: do step 6 and add `META_LOGIN_CONFIG_ID` |
| Facebook says "URL blocked" or redirect mismatch | The Valid OAuth Redirect URI (step 4) must match exactly |
| "No Facebook Page was found" | Create a Page, or tick your Page in the Facebook window, then connect again. If Meta still lists no Page (Facebook Login for Business), add the secret `META_PAGE_ID` = the numeric ID of your Page (Page, About, Page transparency, or Meta Business Suite settings) and connect again |
| Connected, but no Instagram | Link the Instagram Business/Creator account to the Page (Page settings, Linked accounts), then connect again |
| "Meta refused ... permission" | You are not Admin/Developer/Tester of the Meta app, or a permission was not added (step 3) |
| "The Facebook login expired" | Press Connect again (this also happens after you change your Facebook password) |
| Posts stay "approved" | `META_CRON_SECRET` is missing in GitHub, it differs from `CRON_SECRET`, or 0011 was not run |

---

## 13. Connect LinkedIn

Needs your own LinkedIn developer app. Posting to your **personal profile** works right away. **Company Pages** and reading comments need extra approval from LinkedIn and are not included.

1. Run `supabase/migrations/0012_more_platforms.sql` in the Supabase SQL editor (adds LinkedIn and Google Business as platforms).
2. Go to https://www.linkedin.com/developers/apps and press **Create app**. LinkedIn asks for a Company Page to link; create an empty one if you have none.
3. Open the app -> **Products** and add **Share on LinkedIn** and **Sign In with LinkedIn using OpenID Connect**.
4. Open **Auth** and add this redirect URL: `https://wdgkekjqxodhvrfedeyc.supabase.co/functions/v1/linkedin-callback`
5. Copy **Client ID** and **Client Secret** from the Auth tab. In Supabase -> Edge Functions -> Secrets add `LINKEDIN_CLIENT_ID` and `LINKEDIN_CLIENT_SECRET` (`OAUTH_STATE_SECRET` and `SITE_URL` are the same as for YouTube).
6. Run the **Deploy functions** workflow in GitHub Actions.
7. In the dashboard open **Accounts** -> **Connect LinkedIn**.

Notes: the LinkedIn login lasts about 60 days; connect again when the post says it expired. Pictures up to 8 MB are supported; video posts to LinkedIn are not yet. Optional secret `LINKEDIN_API_VERSION` (format YYYYMM) if LinkedIn retires the default version.

### Videos

You can attach an **MP4 video** (up to 50 MB) to a post. Facebook publishes it as a video and Instagram as a **Reel** (Instagram needs 3 to 90 seconds, H.264 video and AAC audio; vertical 9:16 looks best). Instagram can take up to about 100 seconds to process it; if it says "still processing", press **Publish now** again after a minute. LinkedIn video posts are not supported yet, and YouTube/TikTok videos are still posted by hand.

Supabase's free plan accepts files up to 50 MB. On a paid plan raise "Global file size limit" in Storage settings and the limit of the `post-media` bucket if you need bigger videos.

## 14. Connect Google Business Profile

Posts "What's new" updates (text and one picture, no video, no hashtags) to **one location** of your Business Profile. It uses the same Google Cloud project and OAuth client as YouTube. **It only works after Google approves your project for the Business Profile APIs.**

1. Ask Google for access: open https://developers.google.com/my-business/content/prereqs and follow "Request access" (the Business Profile API access form). Use your Google Cloud project number. Approval can take several days. You need a Business Profile that is verified and at least 60 days old.
2. After approval, in Google Cloud -> APIs & Services -> Library enable: **My Business Account Management API**, **My Business Business Information API** and **Google My Business API**.
3. OAuth consent screen -> add the scope `https://www.googleapis.com/auth/business.manage` and make sure your Google account is a test user (or the app is published).
4. Credentials -> your OAuth client -> add this Authorized redirect URI: `https://wdgkekjqxodhvrfedeyc.supabase.co/functions/v1/gbp-callback`
5. The secrets are the same as YouTube (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `OAUTH_STATE_SECRET`). Run the **Deploy functions** workflow in GitHub Actions.
6. Run `0012_more_platforms.sql` if you have not yet. In the dashboard open **Accounts** -> **Connect Google Business** and use the Google account that manages the profile.

Notes: the first location of the account is connected. If Google says "access refused" while connecting, the API approval is not finished yet.

## 15. Scheduler (posts go out on time)

GitHub's own schedule can run hours late. Supabase can call the `meta-cron` function every minute instead (free plan included).

1. Run `supabase/migrations/0013_scheduler.sql` in the SQL editor (turns on pg_cron and pg_net and creates two jobs).
2. Still in the SQL editor, store the two values it needs (replace the text in quotes; the second must be exactly your `CRON_SECRET` from Edge Function secrets). Do not share this query:

```sql
select vault.create_secret('https://wdgkekjqxodhvrfedeyc.supabase.co', 'project_url');
select vault.create_secret('PASTE-YOUR-CRON-SECRET-HERE', 'cron_secret');
```

3. Check: in a minute run `select status, return_message from cron.job_run_details order by start_time desc limit 3;` (should say `succeeded`) and, in Edge Functions -> meta-cron -> Logs, look for a request every minute.
4. Change a secret later: Supabase -> Vault, edit `cron_secret`.

The jobs: every minute they publish approved posts that are due (no comment import), and every 5 minutes they also import new comments. The old GitHub schedule is switched off; the workflow can still be started by hand.
## 16. YouTube: post videos and answer comments

YouTube was read-only (channel numbers). The app now also **posts videos** and **reads and answers comments**.

1. Run `supabase/migrations/0014_scopes_visible.sql` in the SQL editor (lets the app see which permissions a connection has).
2. In Google Cloud -> **Google Auth Platform** (OAuth consent screen) -> **Data access** -> **Add or remove scopes**, add `.../auth/youtube.upload` and `.../auth/youtube.force-ssl` (next to `youtube.readonly`). Save.
3. Merge the PR, then run the **Deploy functions** workflow (the scheduler deploy runs by itself on merge).
4. In the dashboard open **Accounts**. YouTube shows "Connect again": press it and tick **all** permissions on Google's screen.
5. Post: pick YouTube and add an MP4 video (up to 50 MB). The first line of the caption is the video title, the rest is the description.
6. Comments: unanswered comments on your channel reach the Inbox (every 5 minutes, or press the sync button). Answer there; the reply goes to YouTube.

Good to know:
- **Videos stay private until Google audits your project.** Google forces uploads from unaudited projects to private. You can switch a video to public in YouTube Studio. To lift this, apply for the "YouTube API Services Audit" (search for it in Google's help); it takes some weeks.
- **Test mode logins expire after 7 days.** While the Google app is "Testing", the connection stops working after a week and you must connect again. In Google Auth Platform -> Audience press **Publish app** (it can stay unverified: Google then shows a warning screen on connect and allows up to 100 users) and the logins no longer expire.
- Daily limit: Google gives each project 10,000 units a day; an upload costs 1,600, so about 6 videos a day. Replying costs 50.

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

### Plans: Free and Pro (upgrade system)

Every account starts on the **Free** plan. **AI pictures** and **AI videos** are Pro features. Everyone sees the
AI picture / AI video boxes in the Design Studio; on Free, pressing **Make picture** or **Make video** (or the
**Upgrade** links in those boxes, the top bar **Upgrade** button, the dashboard **Plan** card or **Plan & Billing** in
the sidebar) opens the upgrade window. The server also refuses the request (error 402), so the browser cannot bypass it.

**How an upgrade happens**

1. The customer sends an upgrade request (phone / WhatsApp / email + optional note) from the upgrade window or the
   **Plan & Billing** page.
2. You open **Admin** in the sidebar (only admins see it), contact the customer, agree the price and take the payment
   yourself (bank transfer, JazzCash, Easypaisa ...). No payment gateway is connected yet.
3. Press **Approve**. The account switches to Pro. The customer sees it when they reload or return to the tab.
   In **Admin -> Accounts** you can also move any account to Pro or back to Free at any time.

**One-time setup**

1. Run `0007_media_quota.sql`, `0009_plans.sql` and `0010_upgrade_requests.sql` in the Supabase SQL Editor (in this
   order; each needs 0001 first and is safe to run again).
2. Make yourself an admin (this is the only way to become one; change the email):

```sql
insert into public.app_admins (user_id)
select id from auth.users where email = 'you@example.com'
on conflict do nothing;
```

3. Make your own account Pro too if you want to use AI pictures yourself: open **Admin -> Accounts** and pick **Pro**
   next to your account.
4. Optional, in GitHub -> Settings -> Secrets and variables -> Actions -> repository secrets:
   `VITE_PRO_PRICE` (text shown on the Plan page, for example `PKR 4,999 / month`) and `VITE_UPGRADE_CONTACT`
   (your email or an `https://` page, used when someone cannot send a request from the site).

AI pictures cost money per picture: billing must be on for the Google project that owns `GEMINI_API_KEY`. Daily limit
per user: secret `AI_IMAGE_DAILY_LIMIT` (default 10). Model list: optional secret `GEMINI_IMAGE_MODEL`. The function
`generate-image` is deployed by the same GitHub Action. AI video is shown as "coming soon" for Pro accounts.

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

## Legal pages (needed for Google and Meta approval)

The site has three public pages that need no login: `/privacy.html`, `/terms.html` and `/data-deletion.html`
(source: the `public/` folder). Google (OAuth consent screen, Branding) and Meta (App settings, Basic) ask for these
links, and Meta also asks for the data deletion URL. Check that the contact email at the bottom of each page
(`marketectify@gmail.com`) is the one you want to publish, and edit the files if not.

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
| Facebook and Instagram for other people's Pages | Meta App Review and Business Verification (your own Page already works, see step 12) |
| Publishing to TikTok | A TikTok developer app and approval for the Content Posting API |
| Publishing to YouTube | A Google Cloud project with the YouTube Data API v3 and OAuth consent verification |
| Receiving direct messages (DMs), and instant (instead of every 5 minutes) comments | Extra Meta approval for messaging, and Meta webhooks |

The platform approvals can take days or weeks, so it is worth starting those applications early.
