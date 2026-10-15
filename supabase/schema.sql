-- Ритм: одна строка с данными на пользователя. Видит и меняет только владелец.
create table if not exists public.states (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.states enable row level security;
drop policy if exists "own select" on public.states;
drop policy if exists "own insert" on public.states;
drop policy if exists "own update" on public.states;
create policy "own select" on public.states for select using (auth.uid() = user_id);
create policy "own insert" on public.states for insert with check (auth.uid() = user_id);
create policy "own update" on public.states for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Доступ к таблице только для вошедших (анонимам — ничего).
revoke all on public.states from anon;
grant select, insert, update on public.states to authenticated;
-- Ограничение размера данных одного пользователя (защита от злоупотреблений).
alter table public.states drop constraint if exists states_size;
alter table public.states add constraint states_size check (pg_column_size(data) < 2000000);
