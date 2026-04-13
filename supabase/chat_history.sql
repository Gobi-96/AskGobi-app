-- AskGobi chat history schema (run in Supabase SQL Editor)

create extension if not exists pgcrypto;

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  project_id uuid null references public.projects(id) on delete set null,
  title text not null default 'New chat',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.conversations
  add column if not exists project_id uuid null references public.projects(id) on delete set null;

create table if not exists public.messages (
  id bigint generated always as identity primary key,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null default auth.uid(),
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_conversations_user_updated
  on public.conversations (user_id, updated_at desc);
create index if not exists idx_conversations_project
  on public.conversations (project_id, updated_at desc);
create index if not exists idx_projects_user_name
  on public.projects (user_id, name);

create index if not exists idx_messages_conversation_created
  on public.messages (conversation_id, created_at asc);

alter table public.projects enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;

drop policy if exists projects_select_own on public.projects;
drop policy if exists projects_insert_own on public.projects;
drop policy if exists projects_update_own on public.projects;
drop policy if exists projects_delete_own on public.projects;

create policy projects_select_own on public.projects
  for select using (auth.uid() = user_id);

create policy projects_insert_own on public.projects
  for insert with check (auth.uid() = user_id);

create policy projects_update_own on public.projects
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy projects_delete_own on public.projects
  for delete using (auth.uid() = user_id);

drop policy if exists conversations_select_own on public.conversations;
drop policy if exists conversations_insert_own on public.conversations;
drop policy if exists conversations_update_own on public.conversations;
drop policy if exists conversations_delete_own on public.conversations;

create policy conversations_select_own on public.conversations
  for select using (auth.uid() = user_id);

create policy conversations_insert_own on public.conversations
  for insert with check (auth.uid() = user_id);

create policy conversations_update_own on public.conversations
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy conversations_delete_own on public.conversations
  for delete using (auth.uid() = user_id);

drop policy if exists messages_select_own on public.messages;
drop policy if exists messages_insert_own on public.messages;
drop policy if exists messages_update_own on public.messages;
drop policy if exists messages_delete_own on public.messages;

create policy messages_select_own on public.messages
  for select using (auth.uid() = user_id);

create policy messages_insert_own on public.messages
  for insert with check (auth.uid() = user_id);

create policy messages_update_own on public.messages
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy messages_delete_own on public.messages
  for delete using (auth.uid() = user_id);
