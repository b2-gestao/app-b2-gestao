-- Análise com IA · cache compartilhado das respostas da edge function app-ia.
--
-- A chave é o SHA-256 de (versão do prompt, modelo, tela, data de hoje, dados enviados).
-- Qualquer mudança nos números gera outra chave, então uma resposta do cache nunca é de
-- dados diferentes. Usuários que analisam os mesmos dados no mesmo dia reaproveitam a
-- mesma resposta e não pagam outra chamada ao provedor.
--
-- Só a edge function lê e grava (service role). Não guarda os dados enviados, só o hash.
-- A própria função apaga as linhas com mais de 2 dias a cada gravação.
--
-- Economia: select count(*) as chamadas_pagas, sum(hits) as reaproveitadas from app_ia_cache;

create table if not exists public.app_ia_cache (
  hash text primary key,
  tela text not null,
  modelo text not null,
  resposta jsonb not null,
  tokens_entrada integer,
  tokens_saida integer,
  tokens_raciocinio integer,
  tokens_cache integer,
  hits integer not null default 0,
  criado_em timestamptz not null default now(),
  ultimo_uso timestamptz not null default now()
);

create index if not exists app_ia_cache_criado_em on public.app_ia_cache (criado_em);

alter table public.app_ia_cache enable row level security;
-- Sem políticas: anon e authenticated não enxergam nada; a service role ignora a RLS.
revoke all on public.app_ia_cache from anon, authenticated;
