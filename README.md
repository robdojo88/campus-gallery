# KATOL Galleria

Camera-first real-time campus social platform built with Next.js, Tailwind, and Supabase.

## 1. Install

```bash
npm install
```

## 2. Environment

Create `.env.local` from `.env.example`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY
```

## 3. Supabase Database + Storage

Run the SQL file in Supabase SQL Editor:

- `supabase/schema.sql`

This creates:

- Tables (`users`, `posts`, `likes`, `comments`, `incognito_posts`, `freedom_wall_posts`, `reviews`, `events`)
- RLS policies
- Auth user profile trigger
- `captures` storage bucket + storage policies
- Realtime publication entries

## 4. Run

```bash
npm run dev
```

Open `http://localhost:3000`.

## What is wired

- Email/password register + login (Supabase Auth)
- Role-aware profile bootstrap in `public.users`
- Camera single capture upload to Supabase Storage + `posts` insert
- Multi-capture batch upload (all-or-nothing)
- Offline capture queue (IndexedDB) + auto-sync on reconnect
- Realtime feed refresh via Supabase Realtime
- Feed/profile/reviews/freedom wall/incognito/gallery/admin pages reading real data

## Notes

- Device file uploads are intentionally disabled. Capture is camera-only.
- If you changed anon key, update `.env.local` and restart dev server.
