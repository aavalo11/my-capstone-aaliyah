-- Crossfade database setup. Paste into Supabase → SQL Editor → Run.
-- Safe to run more than once.
-- One row per Crossfade link a sender has created (PRD R1, R3).

create table if not exists public.links (
  id bigint generated always as identity primary key,
  code text unique not null,
  title text not null,
  apple_url text not null,
  track_count int not null,
  matched_count int not null,
  created_at timestamptz not null default now(),
  constraint links_track_count check (track_count between 1 and 100),
  constraint links_matched_count check (matched_count between 0 and track_count)
);

-- The publishable key in src/config.js can read links but never write them.
-- Writes will come from the Week 9 Edge Function, which uses the secret key server-side.
alter table public.links enable row level security;
drop policy if exists "Anyone can read links" on public.links;
create policy "Anyone can read links" on public.links for select to anon using (true);
grant select on public.links to anon;

-- Two sample rows so Home → Recently added has something to show.
insert into public.links (code, title, apple_url, track_count, matched_count) values
  ('x7Kq2mVb9R', 'late train home', 'https://music.apple.com/us/playlist/late-train-home/pl.u-8aAVZ', 25, 23),
  ('Qm3pT8wZ1a', 'study, no words', 'https://music.apple.com/us/playlist/study-no-words/pl.u-0zZ1', 18, 18)
on conflict (code) do nothing;

-- One profile per signed-in sender (ADR 0020, backlog S18). Anyone can read profiles, so a
-- profile link works for a friend who never signs in. Only you can create or change your own row.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  username_key text generated always as (lower(username)) stored,
  display_name text not null default '',
  avatar_url text not null default '',
  bio text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_format check (username ~ '^[A-Za-z0-9_]{3,20}$'),
  constraint profiles_username_key unique (username_key),
  constraint profiles_display_name_length check (char_length(display_name) <= 50),
  constraint profiles_bio_length check (char_length(bio) <= 160)
);

alter table public.profiles enable row level security;
drop policy if exists "Anyone can read profiles" on public.profiles;
create policy "Anyone can read profiles" on public.profiles for select to anon, authenticated using (true);
drop policy if exists "Senders create their own profile" on public.profiles;
create policy "Senders create their own profile" on public.profiles for insert to authenticated
  with check ((select auth.uid()) = id);
drop policy if exists "Senders change their own profile" on public.profiles;
create policy "Senders change their own profile" on public.profiles for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
grant select on public.profiles to anon, authenticated;
grant insert, update (username, display_name, avatar_url, bio, updated_at) on public.profiles to authenticated;
grant insert (id) on public.profiles to authenticated;
