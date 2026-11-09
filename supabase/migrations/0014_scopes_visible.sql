-- Lets the app see which Google permissions a connected account has (for example "can post videos").
-- This is only a list of permission names, never a token. Safe to run more than once.
grant select (scopes) on public.social_accounts to authenticated;
