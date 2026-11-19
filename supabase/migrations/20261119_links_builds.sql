-- Phase 10: real links (architecture §4, ADR 0029). Paste into Supabase → SQL Editor → Run.
-- Safe to run more than once.
--
-- Writes happen only inside the Edge Functions, with the secret key, which skips row-level
-- security. The browser's publishable key can't read or write these tables directly: it can
-- only call the functions at the bottom, and each one returns or changes just what it should.
--
-- This REPLACES the shell `links` table from supabase/schema.sql (two sample rows, nothing
-- real), because its columns don't match the real ones.

drop table if exists public.link_tracks;
drop table if exists public.links cascade;

-- One row per Crossfade link a signed-in sender has published.
create table public.links (
  id bigint generated always as identity primary key,
  code text not null unique,
  owner_id uuid not null references auth.users (id) on delete cascade,
  title text not null,                       -- the sender's name for it
  source_url text not null,                  -- the Apple Music link
  apple_name text not null,
  apple_owner text,                          -- Apple display name (ADR 0025)
  artwork_url text,
  spotify_playlist_id text not null,
  track_count int not null,
  matched_count int not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,                    -- set when the sender deletes it (R5 "removed")
  constraint links_code_format check (code ~ '^[A-Za-z0-9]{10}$'),
  constraint links_title_length check (char_length(title) between 1 and 100),
  constraint links_track_count check (track_count between 1 and 200),
  constraint links_matched_count check (matched_count between 0 and track_count)
);
create index links_owner on public.links (owner_id, created_at desc);

-- Every song on a link, in the order the friend sees it.
create table public.link_tracks (
  link_id bigint not null references public.links (id) on delete cascade,
  position int not null,                     -- 0-based
  source_title text not null,
  source_artist text not null,
  isrc text,                                 -- always null in v1 (ADR 0012)
  tier text not null,                        -- exact | close | unmatched | added (ADR 0029)
  spotify_track_id text,
  spotify_title text,
  spotify_artists text,
  artwork_url text,
  duration_ms int,
  near_track_id text,                        -- ADR 0026, unmatched rows only
  near_title text,
  near_artists text,
  primary key (link_id, position),
  constraint link_tracks_tier check (tier in ('exact', 'close', 'unmatched', 'added'))
);

-- One row per match attempt: the rate limit (R6), progress, and the draft the sender edits.
create table if not exists public.builds (
  id uuid primary key,
  owner_id uuid references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  done int not null default 0,
  total int not null default 0,
  status text not null default 'running',
  draft jsonb,                               -- the match result, until it's published (ADR 0029)
  constraint builds_status check (status in ('running', 'matched', 'ok', 'failed'))
);
create index if not exists builds_owner_time on public.builds (owner_id, created_at desc);

alter table public.links enable row level security;
alter table public.link_tracks enable row level security;
alter table public.builds enable row level security;
-- No policies on purpose: anon and authenticated get nothing from the tables themselves.
revoke all on public.links, public.link_tracks, public.builds from anon, authenticated;

-- A friend opens /p/<code> (architecture §3). Returns only that link, or null.
create or replace function public.get_link(p_code text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select case when l.id is null then null
    when l.deleted_at is not null then jsonb_build_object('removed', true)
    else jsonb_build_object(
      'code', l.code, 'name', l.title, 'owner', l.apple_owner, 'artwork_url', l.artwork_url,
      'spotify_playlist_id', l.spotify_playlist_id, 'created_at', l.created_at,
      'sender', (select p.username from public.profiles p where p.id = l.owner_id),
      'tracks', coalesce((select jsonb_agg(jsonb_build_object(
          'position', t.position, 'source_title', t.source_title, 'source_artist', t.source_artist,
          'tier', t.tier, 'spotify_track_id', t.spotify_track_id, 'spotify_title', t.spotify_title,
          'spotify_artists', t.spotify_artists, 'artwork_url', t.artwork_url, 'duration_ms', t.duration_ms,
          'near_track_id', t.near_track_id, 'near_title', t.near_title, 'near_artists', t.near_artists)
          order by t.position) from public.link_tracks t where t.link_id = l.id), '[]'::jsonb))
    end
  from (select 1) one left join public.links l on l.code = p_code;
$$;

-- Create's progress line while matching. Only the build's own sender can read it.
create or replace function public.get_build(p_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('done', b.done, 'total', b.total, 'status', b.status)
  from public.builds b where b.id = p_id and b.owner_id = (select auth.uid());
$$;

-- Playlists → Made by me: the signed-in sender's own links, newest first (ADR 0021).
create or replace function public.my_links()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'code', l.code, 'title', l.title, 'apple_url', l.source_url, 'owner', l.apple_owner,
      'artwork_url', l.artwork_url, 'spotify_playlist_id', l.spotify_playlist_id,
      'track_count', l.track_count, 'matched_count', l.matched_count,
      'created_at', l.created_at, 'updated_at', l.updated_at)
      order by l.created_at desc), '[]'::jsonb)
  from public.links l where l.owner_id = (select auth.uid()) and l.deleted_at is null;
$$;

-- Rename keeps the code, so a link already texted keeps working (ADR 0010).
create or replace function public.rename_link(p_code text, p_title text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if char_length(trim(coalesce(p_title, ''))) not between 1 and 100 then
    raise exception 'bad-title' using errcode = '22023';
  end if;
  update public.links set title = trim(p_title), updated_at = now()
    where code = p_code and owner_id = (select auth.uid()) and deleted_at is null;
  return found;
end $$;

-- Delete marks the link removed: the friend sees "removed by whoever sent it" (R5).
create or replace function public.delete_link(p_code text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  update public.links set deleted_at = now(), updated_at = now()
    where code = p_code and owner_id = (select auth.uid()) and deleted_at is null;
  return found;
end $$;

revoke all on function public.get_link(text), public.get_build(uuid), public.my_links(),
  public.rename_link(text, text), public.delete_link(text) from public;
grant execute on function public.get_link(text) to anon, authenticated;
grant execute on function public.get_build(uuid), public.my_links(),
  public.rename_link(text, text), public.delete_link(text) to authenticated;
-- Supabase grants new functions to anon by default, which "from public" doesn't undo.
-- Signed out, these returned nothing anyway (auth.uid() is null); this makes it explicit.
revoke execute on function public.get_build(uuid), public.my_links(),
  public.rename_link(text, text), public.delete_link(text) from anon;
