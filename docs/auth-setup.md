# Auth Setup (Google OAuth + Anonymous Sessions)

The app is wired for Google sign-in with anonymous-session fallback. To turn
it on in your Supabase project, do these three steps once. Until they're
done, the app automatically runs in "local only" mode — everything still
works on a single device, it just can't sync across devices.

## 1. Enable anonymous sign-ins

Supabase → Authentication → Providers → scroll to **"Anonymous Sign-Ins"**
→ toggle on.

No other configuration needed. This lets new users immediately have a
stable `user_id` without signing in.

## 2. Enable Google provider

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
   and create an OAuth 2.0 Client ID (Web application).
   - **Authorized redirect URIs:** paste the callback URL that Supabase
     shows you in the next step (it looks like
     `https://<project-ref>.supabase.co/auth/v1/callback`).
2. In Supabase → Authentication → Providers → **Google** → toggle on and
   paste the Client ID and Client Secret.
3. Under **Site URL** in Auth settings, make sure `https://sift-in.vercel.app`
   (and any custom domain) is listed. Local dev: `http://localhost:3000`.

The app's callback route at `/auth/callback` already handles the
redirect back.

## 3. Row-level security policies + user data schema

Run [`docs/cloud-migration.sql`](./cloud-migration.sql) first — it adds
the JSONB columns the app now uses to persist scan history, compare
list, recent searches, and onboarded flag into `user_profiles`. Then
run the RLS policies below.

Without the migration, the app falls back to a "Database migration
required" message on the Profile page and won't persist user data.

### RLS policies

```sql
-- user_profiles: each row belongs to exactly one user
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own profile"
  ON public.user_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile"
  ON public.user_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
  ON public.user_profiles FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- scans: history is personal
ALTER TABLE public.scans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own scans"
  ON public.scans FOR SELECT
  USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can insert their own scans"
  ON public.scans FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- community_submissions: users see their own submissions + approved
ALTER TABLE public.community_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own submissions or approved ones"
  ON public.community_submissions FOR SELECT
  USING (auth.uid() = user_id OR status = 'approved');

CREATE POLICY "Users can submit products"
  ON public.community_submissions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- products: globally readable, writes go through the API (service role)
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Products are publicly readable"
  ON public.products FOR SELECT
  USING (true);
-- Note: no INSERT/UPDATE policies here — all product writes go through
-- API routes using the service role key, which bypasses RLS.
```

## What the app does automatically

- On first visit, creates an anonymous session — the user immediately has
  a stable `user_id` and can save conditions/allergies locally.
- Profile page shows "Sign in with Google" for anonymous users.
- After Google sign-in, the app merges local profile state with any
  existing cloud profile (union of conditions/allergies, cloud language
  wins) and pushes the result back to the cloud.
- All subsequent profile edits sync to `user_profiles` automatically.
- "Sign out" reverts to anonymous mode — local data stays, cross-device
  sync stops.

## Verifying it works

1. Open the app in an incognito window → you should see "Sign in with
   Google" on the Profile page.
2. Click it → Google consent screen → redirects back to Profile.
3. Profile page now shows your name, email, avatar, and a "Sign out"
   link.
4. Open the app in another browser → sign in with the same Google
   account → your conditions/allergies should appear automatically.

## Troubleshooting

- **"Cloud sync not yet enabled for this deployment"** — Anonymous sign-ins
  isn't toggled on in Supabase. Step 1.
- **"Invalid redirect URI"** on Google consent → the URI in Google Cloud
  Console doesn't match Supabase's callback URL. Copy the one Supabase
  shows, exactly.
- **Profile page keeps showing "Guest"** — the `user_profiles` table is
  missing, or RLS is on but the policies above haven't been applied.
- **No session after callback** — Check that your site URL is listed in
  Supabase Auth → URL Configuration → Site URL + Redirect URLs.
