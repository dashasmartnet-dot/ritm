-- Ритм: пуш-напоминания на телефон.
create table if not exists public.push_subs (
  endpoint text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  sub jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.push_subs enable row level security;
drop policy if exists "own subs" on public.push_subs;
create policy "own subs" on public.push_subs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select, insert, update, delete on public.push_subs to authenticated;

create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id text not null,
  title text not null,
  due date,
  at_time text,
  fire_at timestamptz not null,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists reminders_due_idx on public.reminders (fire_at) where sent_at is null;
alter table public.reminders enable row level security;
drop policy if exists "own reminders" on public.reminders;
create policy "own reminders" on public.reminders for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select, insert, delete on public.reminders to authenticated;

-- служебные ключи (только для сервера)
create table if not exists public.app_secrets (name text primary key, value text not null);
alter table public.app_secrets enable row level security;
revoke all on public.app_secrets from anon, authenticated;
grant select, insert on public.app_secrets to service_role;
grant select, update, delete on public.reminders to service_role;
grant select, delete on public.push_subs to service_role;

-- раз в минуту проверяем, кому пора напомнить
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.unschedule('ritm-push') where exists (select 1 from cron.job where jobname = 'ritm-push');
select cron.schedule('ritm-push', '* * * * *', $$
  select net.http_post(
    url := 'https://soosbghkbnoruqhwjdtq.supabase.co/functions/v1/push',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{"cron":true}'::jsonb
  );
$$);
