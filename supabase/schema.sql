-- Plano Semanal de Lavra · estrutura no Supabase
-- Cole este script no SQL Editor do projeto Supabase e clique em Run.

create table if not exists public.atividades (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.config (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.atividades enable row level security;
alter table public.config enable row level security;

-- Acesso para quem tem o link do app (chave pública "anon").
-- Para restringir por login, troque estas políticas por regras com auth.uid().
drop policy if exists "equipe le e grava atividades" on public.atividades;
create policy "equipe le e grava atividades" on public.atividades for all to anon, authenticated using (true) with check (true);
drop policy if exists "equipe le e grava config" on public.config;
create policy "equipe le e grava config" on public.config for all to anon, authenticated using (true) with check (true);

-- Atualização em tempo real entre celulares e PCs
alter publication supabase_realtime add table public.atividades;
alter publication supabase_realtime add table public.config;
