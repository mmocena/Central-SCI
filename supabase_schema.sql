-- ============================================================
-- Central SCI — Schema do banco de dados
-- Executar no Supabase SQL Editor
-- ============================================================

-- Tipos de extintor (configurado pelo admin)
create table tipos_extintor (
  id uuid primary key default gen_random_uuid(),
  tipo text not null,          -- ex: CO², PQS BC, PQS ABC, Água
  kg numeric(5,1) not null,    -- ex: 4.0, 6.0, 12.0
  ativo boolean default true,
  criado_em timestamptz default now()
);

-- Fatores de não operacionalidade (configurado pelo admin)
create table fatores_nao_operacionalidade (
  id uuid primary key default gen_random_uuid(),
  descricao text not null,
  ativo boolean default true,
  ordem int default 0
);

-- Locais (cadastrado pelo admin)
create table locais (
  id uuid primary key default gen_random_uuid(),
  numero int not null unique,
  edificacao text not null,
  descricao text,
  tem_slot_a boolean default true,
  tem_slot_b boolean default false,
  planta_tipo_exigido text,         -- ex: CO²
  planta_cap_ext_exigida text,      -- ex: 5-B:C
  ativo boolean default true,
  criado_em timestamptz default now()
);

-- Estado atual de cada local/slot (snapshot, atualizado parcialmente)
create table local_estado_atual (
  id uuid primary key default gen_random_uuid(),
  local_id uuid not null references locais(id) on delete cascade,
  slot char(1) not null check (slot in ('A', 'B')),
  unique (local_id, slot),

  -- dados do extintor atual
  extintor_tipo text,
  extintor_kg numeric(5,1),
  cap_ext_atual text,              -- ex: 20-B:C
  reserva_empresa boolean default false,

  -- conformidade (calculada ao registrar)
  situacao_conformidade text check (
    situacao_conformidade in ('conforme', 'alerta', 'nao_conforme')
  ),
  motivo_nao_conformidade text,
  observacoes text,

  -- manutenção
  em_manutencao boolean default false,
  ordem_manutencao_id uuid,        -- FK adicionada após criar ordens_manutencao

  -- dados da última inspeção
  data_ultima_inspecao timestamptz,
  responsavel_ultima_inspecao text,
  equipe_ultima_inspecao text,
  validade_nivel2 date,
  validade_nivel3 date,

  -- dados da última logística
  data_ultima_logistica timestamptz,
  responsavel_ultima_logistica text,
  equipe_ultima_logistica text,

  atualizado_em timestamptz default now()
);

-- Ordens de manutenção
create table ordens_manutencao (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'PENDENTE' check (status in ('PENDENTE', 'CONCLUIDA')),

  local_id uuid not null references locais(id),
  slot char(1) not null check (slot in ('A', 'B')),

  -- extintor que saiu
  extintor_saiu_tipo text not null,
  extintor_saiu_kg numeric(5,1),
  nivel_manutencao int not null check (nivel_manutencao in (2, 3)),

  -- substituto colocado no lugar
  substituto_tipo text,
  substituto_kg numeric(5,1),
  substituto_cap_ext text,
  substituto_reserva boolean default false,
  substituto_operacional boolean default true,

  -- abertura
  data_saida timestamptz default now(),
  responsavel_saida text not null,
  equipe_saida text not null,

  -- recebimento
  data_retorno timestamptz,
  responsavel_retorno text,
  equipe_retorno text,
  extintor_retornou_para text check (extintor_retornou_para in ('LOCAL', 'ESTOQUE')),

  criado_em timestamptz default now()
);

-- FK circular: local_estado_atual → ordens_manutencao
alter table local_estado_atual
  add constraint fk_ordem_manutencao
  foreign key (ordem_manutencao_id)
  references ordens_manutencao(id)
  on delete set null;

-- Histórico de operações (append-only, nunca alterado)
create table historico_operacoes (
  id uuid primary key default gen_random_uuid(),
  modo text not null check (modo in ('inspecao', 'logistica_envio', 'logistica_retorno', 'estoque')),

  local_id uuid references locais(id),
  slot char(1) check (slot in ('A', 'B')),
  ordem_manutencao_id uuid references ordens_manutencao(id),

  data_operacao timestamptz default now(),
  responsavel text not null,
  equipe text not null check (equipe in ('ALFA', 'BRAVO', 'CHARLIE', 'DELTA')),

  payload jsonb not null default '{}'
);

-- Estoque (1 linha por tipo de extintor)
create table estoque_estado_atual (
  id uuid primary key default gen_random_uuid(),
  tipo_extintor_id uuid not null references tipos_extintor(id),
  unique (tipo_extintor_id),
  qtd_operacional int not null default 0,
  qtd_nao_operacional int not null default 0,
  data_ultima_verificacao timestamptz,
  responsavel_ultima_verificacao text,
  atualizado_em timestamptz default now()
);

-- Histórico de verificações de estoque
create table historico_estoque (
  id uuid primary key default gen_random_uuid(),
  data_operacao timestamptz default now(),
  responsavel text not null,
  equipe text not null,
  payload jsonb not null default '{}'
);

-- ============================================================
-- Realtime: habilitar para a tabela de estado atual
-- ============================================================
alter publication supabase_realtime add table local_estado_atual;
alter publication supabase_realtime add table ordens_manutencao;

-- ============================================================
-- Dados iniciais de exemplo (remover em produção)
-- ============================================================

-- Alguns tipos de extintor
insert into tipos_extintor (tipo, kg) values
  ('CO²', 6.0),
  ('CO²', 10.0),
  ('PQS BC', 4.0),
  ('PQS BC', 6.0),
  ('PQS ABC', 4.0),
  ('PQS ABC', 6.0),
  ('Água', 10.0);

-- Alguns fatores de não operacionalidade
insert into fatores_nao_operacionalidade (descricao, ordem) values
  ('Manômetro fora da faixa verde', 1),
  ('Lacre violado ou ausente', 2),
  ('Etiqueta de inspeção ausente ou ilegível', 3),
  ('Danos físicos visíveis no cilindro', 4),
  ('Mangueira com rachaduras ou obstrução', 5),
  ('Pino de segurança ausente', 6),
  ('Validade Nível 2 vencida', 7),
  ('Validade Nível 3 vencida', 8);
