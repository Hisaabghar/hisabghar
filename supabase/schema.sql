-- Ledger — Supabase schema
-- Run this in the Supabase SQL editor (or via `supabase db push`).
--
-- Design notes for future multi-client compatibility:
--   * A second "viewer" app can later read this same data. Because RLS is
--     enabled and access is granted per-row via policies (not baked into
--     app code), a second client can be given a different auth role/policy
--     (e.g. a read-only "viewer" role scoped to specific accounts) without
--     any schema changes.
--   * user_id columns are included on both tables so ownership/sharing can
--     be layered in later (e.g. a `account_shares` table) without a
--     migration that touches existing rows.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- accounts ("ledgers") — e.g. "Main Ledger", "Tayyab account"
-- ---------------------------------------------------------------------
create table if not exists public.accounts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text not null check (char_length(trim(name)) > 0),
  created_at  timestamptz not null default now()
);

create index if not exists accounts_user_id_idx on public.accounts(user_id);

-- ---------------------------------------------------------------------
-- transactions — each entry belongs to one account
-- ---------------------------------------------------------------------
create table if not exists public.transactions (
  id              uuid primary key default gen_random_uuid(),
  account_id      uuid not null references public.accounts(id) on delete cascade,
  user_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  type            text not null check (type in ('in', 'out')),
  amount          numeric(14, 2) not null check (amount > 0),
  category        text not null default '',
  note            text not null default '',
  voice_note_url  text,
  created_at      timestamptz not null default now()
);

create index if not exists transactions_account_id_idx on public.transactions(account_id);
create index if not exists transactions_user_id_idx on public.transactions(user_id);
create index if not exists transactions_created_at_idx on public.transactions(created_at desc);

-- ---------------------------------------------------------------------
-- Row Level Security
-- Single-user write access for now: a signed-in user can only see and
-- modify their own accounts/transactions. Because policies key off
-- user_id rather than being hardcoded to "the app", a second client
-- (e.g. a family-member viewer app) can be added later either by:
--   (a) adding a `select`-only policy for a "viewer" role/claim, or
--   (b) adding an `account_shares(account_id, viewer_user_id)` table and
--       extending the select policies to check membership in it.
-- No changes to the tables above would be required for either path.
-- ---------------------------------------------------------------------

alter table public.accounts enable row level security;
alter table public.transactions enable row level security;

create policy "accounts_select_own" on public.accounts
  for select using (auth.uid() = user_id);

create policy "accounts_insert_own" on public.accounts
  for insert with check (auth.uid() = user_id);

create policy "accounts_update_own" on public.accounts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "accounts_delete_own" on public.accounts
  for delete using (auth.uid() = user_id);

create policy "transactions_select_own" on public.transactions
  for select using (auth.uid() = user_id);

create policy "transactions_insert_own" on public.transactions
  for insert with check (auth.uid() = user_id);

create policy "transactions_update_own" on public.transactions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "transactions_delete_own" on public.transactions
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- Storage bucket for voice note audio files
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('voice-notes', 'voice-notes', false)
on conflict (id) do nothing;

-- Files are stored under `${user_id}/${transaction_id}.webm` so ownership
-- can be checked from the path itself.
create policy "voice_notes_select_own" on storage.objects
  for select using (
    bucket_id = 'voice-notes' and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "voice_notes_insert_own" on storage.objects
  for insert with check (
    bucket_id = 'voice-notes' and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "voice_notes_delete_own" on storage.objects
  for delete using (
    bucket_id = 'voice-notes' and auth.uid()::text = (storage.foldername(name))[1]
  );

-- ---------------------------------------------------------------------
-- Seed: nothing seeded here — the app creates a default "Main Ledger"
-- account for a new user on first sign-in (see src/hooks/useAccounts.ts).
-- ---------------------------------------------------------------------
