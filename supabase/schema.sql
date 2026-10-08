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
