-- Run this in the Supabase SQL editor (or psql) after enabling pgvector:
-- create extension if not exists vector;

create table if not exists workspaces (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  name text not null,
  created_at timestamptz default now()
);

create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id),
  filename text not null,
  content_hash text not null,         -- for idempotent ingestion
  created_at timestamptz default now(),
  unique (workspace_id, content_hash) -- prevents duplicate re-uploads
);

-- THE shared vector table — every workspace's chunks live here together.
-- workspace_id is the isolation column: every query against this table MUST filter on it.
create table if not exists chunks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  document_id uuid not null references documents(id),
  content text not null,
  embedding vector(768),              -- must match the embedding model's output dimension
  chunk_index int not null,
  created_at timestamptz default now()
);
create index if not exists chunks_embedding_idx on chunks using ivfflat (embedding vector_cosine_ops);
create index if not exists chunks_workspace_idx on chunks (workspace_id);

create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  role text not null,                 -- 'user' | 'assistant'
  content text not null,
  citations jsonb,
  created_at timestamptz default now()
);
create index if not exists chat_messages_workspace_idx on chat_messages (workspace_id);

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  title text not null,
  due_date date,
  created_at timestamptz default now()
);
create index if not exists tasks_workspace_idx on tasks (workspace_id);

create table if not exists tool_calls (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  tool_name text not null,
  arguments jsonb not null,
  result jsonb,
  status text not null,               -- 'success' | 'error'
  created_at timestamptz default now()
);
create index if not exists tool_calls_workspace_idx on tool_calls (workspace_id);
