-- ============================================================
-- Central SCI — Schema do banco de dados
-- Executar no Supabase SQL Editor
-- ============================================================

-- Tipos de extintor (configurado pelo admin)
create table tipos_extintor (
  id uuid primary key default gen_random_uuid(),
  tipo text not null,          -- ex: CO², PQS BC, PQS ABC, Água
  kg numeric(5,1) not null,    -- ex: 4.0, 6.0, 12.0
  unidade text not null default 'kg' check (unidade in ('kg', 'L')),
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
  descricao_slot_a text,             -- identificação do extintor A (dual-slot)
  descricao_slot_b text,             -- identificação do extintor B (dual-slot)
  planta_tipo_exigido text,          -- ex: CO²
  planta_cap_ext_exigida text,       -- ex: 5-B:C
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

  -- manutenção — colunas não usadas mais pelas RPCs (o local nunca fica
  -- vinculado a uma ordem de manutenção; o controle de pendências é feito
  -- só por ordens_manutencao.status). Mantidas na tabela por segurança,
  -- sem uso ativo.
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

  local_id uuid references locais(id),   -- null = envio direto do estoque (sem local de origem)
  slot char(1) check (slot in ('A', 'B')),

  -- extintor que saiu
  extintor_saiu_tipo text not null,
  extintor_saiu_kg numeric(5,1),
  nivel_manutencao int not null check (nivel_manutencao in (2, 3)),

  -- substituto colocado no lugar
  substituto_tipo text,
  substituto_kg numeric(5,1),
  substituto_cap_ext text,
  substituto_reserva boolean default false,
  substituto_origem text,          -- 'SCI' | 'RESERVA_DEPOSITO' | 'RESERVA_NOVO'
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

  criado_em timestamptz default now(),

  -- fila offline: chave de idempotência gerada no clique, evita duplicar
  -- a ordem se a mesma ação for reenviada automaticamente ao reconectar
  client_op_id uuid unique,
  lote_id uuid,                    -- agrupa as N unidades de um envio em lote (envio direto do estoque)
  estoque_descontado boolean not null default false
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

  payload jsonb not null default '{}',

  -- Conformidade calculada no momento desta operação (só pra modo='inspecao';
  -- fica null nos outros modos). Nunca é reescrita depois — é o retrato da
  -- inspeção, não a situação atual (essa vive em local_estado_atual). Existe
  -- pra facilitar consulta sem abrir o payload jsonb.
  situacao_conformidade text check (situacao_conformidade in ('conforme', 'nao_conforme')),

  -- fila offline: mesma chave de idempotência do client_op_id de ordens_manutencao
  client_op_id uuid unique
);

-- Depósito / estoque de reserva (SCI, RESERVA da empresa e Outros itens não
-- extintores, ex: placa de sinalização), por tipo+kg+categoria+operacionalidade.
-- Itens 'OUTRO' gravam kg=0 (placeholder) e operacional=true sempre — não têm
-- distinção de capacidade nem de operacionalidade.
create table estoque_deposito (
  id uuid primary key default gen_random_uuid(),
  tipo text not null,
  kg numeric(5,1) not null,
  categoria text not null check (categoria in ('SCI', 'RESERVA', 'OUTRO')),
  operacional boolean not null default true,
  unique (tipo, kg, categoria, operacional),
  quantidade int not null default 0,
  atualizado_em timestamptz default now()
);

-- Configurações gerais chave/valor (senha de admin, início do período de vistoria, etc.)
create table configuracoes (
  chave text primary key,
  valor text
);

-- Plano de trocas de Tipo entre locais/estoque — só sugestão, não executa
-- nada sozinho. A pessoa monta o plano antes de ir a campo; a troca física
-- só se confirma de fato quando a inspeção real é registrada nos locais
-- envolvidos (ver limpeza automática em registrar_inspecao). Sincronizado
-- por realtime pra qualquer aparelho ver o mesmo plano.
create table trocas_planejadas (
  id uuid primary key default gen_random_uuid(),

  -- destino: o local que precisa do tipo diferente
  local_id uuid not null references locais(id) on delete cascade,
  slot char(1) not null check (slot in ('A', 'B')),
  unique (local_id, slot),

  -- origem: outro local (troca recíproca de campo) OU uma unidade do depósito
  origem_tipo text not null check (origem_tipo in ('local', 'estoque_sci', 'estoque_reserva')),
  origem_local_id uuid references locais(id),
  origem_slot char(1) check (origem_slot in ('A', 'B')),
  origem_estoque_id uuid references estoque_deposito(id),

  check (
    (origem_tipo = 'local' and origem_local_id is not null and origem_slot is not null and origem_estoque_id is null)
    or
    (origem_tipo in ('estoque_sci', 'estoque_reserva') and origem_estoque_id is not null and origem_local_id is null and origem_slot is null)
  ),
  check (origem_local_id is null or origem_local_id is distinct from local_id),

  definido_por text not null,
  definido_em timestamptz default now()
);

-- Cada origem (local ou unidade de estoque) só pode estar em um plano por
-- vez — é isso que faz a opção sumir das listas dos outros locais quando
-- alguém já a escolheu.
create unique index trocas_planejadas_origem_local_uk
  on trocas_planejadas (origem_local_id, origem_slot)
  where origem_local_id is not null;

create unique index trocas_planejadas_origem_estoque_uk
  on trocas_planejadas (origem_estoque_id)
  where origem_estoque_id is not null;

-- ============================================================
-- Funções (RPC) — cada uma roda em uma única transação, então
-- nunca fica um passo intermediário gravado sem o resto (ex: ordem
-- de manutenção criada sem o desconto de estoque correspondente).
-- Chamadas pela fila offline (src/lib/queries.js) com um client_op_id
-- gerado no clique, garantindo que reenviar a mesma ação não duplica.
-- ============================================================

create or replace function registrar_inspecao(
  p_local_id uuid, p_slot char(1), p_responsavel text, p_equipe text,
  p_payload jsonb, p_conformidade text, p_client_op_id uuid,
  p_extintor_tipo text, p_extintor_kg numeric, p_cap_ext_atual text,
  p_reserva_empresa boolean, p_motivo_nao_conformidade text, p_observacoes text,
  p_validade_nivel2 date, p_validade_nivel3 date
) returns void
language plpgsql
as $$
begin
  insert into historico_operacoes (modo, local_id, slot, responsavel, equipe, payload, situacao_conformidade, client_op_id)
  values ('inspecao', p_local_id, p_slot, p_responsavel, p_equipe, p_payload, p_conformidade, p_client_op_id)
  on conflict (client_op_id) do nothing;

  insert into local_estado_atual (
    local_id, slot, extintor_tipo, extintor_kg, cap_ext_atual, reserva_empresa,
    situacao_conformidade, motivo_nao_conformidade, observacoes,
    validade_nivel2, validade_nivel3, data_ultima_inspecao,
    responsavel_ultima_inspecao, equipe_ultima_inspecao, atualizado_em
  ) values (
    p_local_id, p_slot, p_extintor_tipo, p_extintor_kg, p_cap_ext_atual, coalesce(p_reserva_empresa, false),
    p_conformidade, p_motivo_nao_conformidade, p_observacoes,
    p_validade_nivel2, p_validade_nivel3, now(), p_responsavel, p_equipe, now()
  )
  on conflict (local_id, slot) do update set
    extintor_tipo = excluded.extintor_tipo,
    extintor_kg = excluded.extintor_kg,
    cap_ext_atual = excluded.cap_ext_atual,
    reserva_empresa = excluded.reserva_empresa,
    situacao_conformidade = excluded.situacao_conformidade,
    motivo_nao_conformidade = excluded.motivo_nao_conformidade,
    observacoes = excluded.observacoes,
    validade_nivel2 = excluded.validade_nivel2,
    validade_nivel3 = excluded.validade_nivel3,
    data_ultima_inspecao = excluded.data_ultima_inspecao,
    responsavel_ultima_inspecao = excluded.responsavel_ultima_inspecao,
    equipe_ultima_inspecao = excluded.equipe_ultima_inspecao,
    atualizado_em = excluded.atualizado_em;

  -- A troca física (se houvesse alguma planejada envolvendo este local,
  -- como destino ou como origem) já aconteceu de verdade agora — o plano
  -- não faz mais sentido, some sozinho.
  delete from trocas_planejadas
  where (local_id = p_local_id and slot = p_slot)
     or (origem_local_id = p_local_id and origem_slot = p_slot);
end;
$$;

create or replace function registrar_envio_manutencao(
  p_local_id uuid, p_slot char(1), p_responsavel text, p_equipe text, p_client_op_id uuid,
  p_extintor_saiu_tipo text, p_extintor_saiu_kg numeric, p_nivel_manutencao int,
  p_substituto_tipo text, p_substituto_kg numeric, p_substituto_cap_ext text,
  p_substituto_reserva boolean, p_substituto_origem text, p_substituto_operacional boolean,
  p_payload jsonb, p_conformidade text, p_motivo_nao_conformidade text,
  p_validade_nivel2 date, p_validade_nivel3 date,
  p_desconta_estoque boolean, p_estoque_categoria text
) returns uuid
language plpgsql
as $$
declare
  v_ordem ordens_manutencao%rowtype;
  v_estoque_id uuid;
  v_qtd int;
begin
  select * into v_ordem from ordens_manutencao where client_op_id = p_client_op_id;

  if v_ordem.id is null then
    insert into ordens_manutencao (
      local_id, slot, extintor_saiu_tipo, extintor_saiu_kg, nivel_manutencao,
      substituto_tipo, substituto_kg, substituto_cap_ext, substituto_reserva,
      substituto_origem, substituto_operacional, data_saida, responsavel_saida,
      equipe_saida, client_op_id
    ) values (
      p_local_id, p_slot, p_extintor_saiu_tipo, p_extintor_saiu_kg, p_nivel_manutencao,
      p_substituto_tipo, p_substituto_kg, p_substituto_cap_ext, p_substituto_reserva,
      p_substituto_origem, p_substituto_operacional, now(), p_responsavel, p_equipe, p_client_op_id
    )
    returning * into v_ordem;
  end if;

  insert into historico_operacoes (modo, local_id, slot, ordem_manutencao_id, responsavel, equipe, payload, client_op_id)
  values ('logistica_envio', p_local_id, p_slot, v_ordem.id, p_responsavel, p_equipe, p_payload, p_client_op_id)
  on conflict (client_op_id) do nothing;

  -- O local nunca fica "vinculado" à ordem — recebe o substituto como uma
  -- inspeção normal. O controle de pendência de manutenção é só via
  -- ordens_manutencao.status, consultado à parte (guia Manutenções).
  insert into local_estado_atual (
    local_id, slot, extintor_tipo, extintor_kg, cap_ext_atual, reserva_empresa,
    situacao_conformidade, motivo_nao_conformidade,
    validade_nivel2, validade_nivel3, data_ultima_logistica,
    responsavel_ultima_logistica, equipe_ultima_logistica, atualizado_em
  ) values (
    p_local_id, p_slot, p_substituto_tipo, p_substituto_kg, p_substituto_cap_ext, p_substituto_reserva,
    p_conformidade, p_motivo_nao_conformidade,
    p_validade_nivel2, p_validade_nivel3, now(), p_responsavel, p_equipe, now()
  )
  on conflict (local_id, slot) do update set
    extintor_tipo = excluded.extintor_tipo,
    extintor_kg = excluded.extintor_kg,
    cap_ext_atual = excluded.cap_ext_atual,
    reserva_empresa = excluded.reserva_empresa,
    situacao_conformidade = excluded.situacao_conformidade,
    motivo_nao_conformidade = excluded.motivo_nao_conformidade,
    validade_nivel2 = excluded.validade_nivel2,
    validade_nivel3 = excluded.validade_nivel3,
    data_ultima_logistica = excluded.data_ultima_logistica,
    responsavel_ultima_logistica = excluded.responsavel_ultima_logistica,
    equipe_ultima_logistica = excluded.equipe_ultima_logistica,
    atualizado_em = excluded.atualizado_em;

  -- Idem registrar_inspecao: qualquer plano de troca envolvendo este local
  -- (destino ou origem) já não faz mais sentido — o extintor mudou de verdade.
  delete from trocas_planejadas
  where (local_id = p_local_id and slot = p_slot)
     or (origem_local_id = p_local_id and origem_slot = p_slot);

  if p_desconta_estoque and not v_ordem.estoque_descontado then
    select id, quantidade into v_estoque_id, v_qtd
    from estoque_deposito
    where tipo = p_substituto_tipo and kg = p_substituto_kg
      and categoria = p_estoque_categoria and operacional = true
    limit 1;

    if v_estoque_id is not null then
      update estoque_deposito
      set quantidade = greatest(0, v_qtd - 1), atualizado_em = now()
      where id = v_estoque_id;
    end if;

    update ordens_manutencao set estoque_descontado = true where id = v_ordem.id;
  end if;

  return v_ordem.id;
end;
$$;

create or replace function registrar_envio_estoque(
  p_tipo text, p_kg numeric, p_nivel int, p_quantidade int,
  p_responsavel text, p_equipe text, p_lote_id uuid
) returns void
language plpgsql
as $$
begin
  if exists (select 1 from ordens_manutencao where lote_id = p_lote_id) then
    return;
  end if;

  insert into ordens_manutencao (
    local_id, slot, extintor_saiu_tipo, extintor_saiu_kg, nivel_manutencao,
    substituto_reserva, data_saida, responsavel_saida, equipe_saida, lote_id
  )
  select null, null, p_tipo, p_kg, p_nivel, false, now(), p_responsavel, p_equipe, p_lote_id
  from generate_series(1, p_quantidade);
end;
$$;

create or replace function registrar_recebimento_ordem(
  p_ordem_id uuid, p_responsavel text, p_equipe text, p_client_op_id uuid,
  p_local_id uuid, p_slot char(1)
) returns void
language plpgsql
as $$
begin
  update ordens_manutencao set
    status = 'CONCLUIDA', data_retorno = now(), responsavel_retorno = p_responsavel,
    equipe_retorno = p_equipe, extintor_retornou_para = 'ESTOQUE'
  where id = p_ordem_id;

  if p_local_id is not null then
    insert into historico_operacoes (modo, local_id, slot, ordem_manutencao_id, responsavel, equipe, payload, client_op_id)
    values ('logistica_retorno', p_local_id, p_slot, p_ordem_id, p_responsavel, p_equipe, jsonb_build_object('destino', 'ESTOQUE'), p_client_op_id)
    on conflict (client_op_id) do nothing;
  end if;
end;
$$;

-- ============================================================
-- Situação atual acompanha validade vencida sozinha, sem depender de nova
-- inspeção: capacidade/sinalização/operacional só mudam numa inspeção nova,
-- mas validade N2/N3 é sensível ao calendário — sem isso, local_estado_atual
-- ficava com situacao_conformidade "congelada" da última inspeção mesmo
-- depois de vencer, enquanto os alertas de vencimento (calculados na hora,
-- no cliente) já mostravam a informação certa. Só de mão única (conforme ->
-- não conforme); nunca reverte — só uma inspeção nova volta a marcar
-- conforme, igual já era antes. Roda 1x por dia; folga de até 24h é
-- aceitável dado que validade é de granularidade mensal/anual.
-- ============================================================
create extension if not exists pg_cron;

create or replace function atualizar_conformidade_por_validade_vencida()
returns void
language plpgsql
security definer
as $$
begin
  update local_estado_atual
  set situacao_conformidade = 'nao_conforme', atualizado_em = now()
  where situacao_conformidade = 'conforme'
    and (validade_nivel2 <= current_date or validade_nivel3 <= current_date);

  -- Acrescenta o motivo (idempotente — só se ainda não estiver no texto).
  -- Textos iguais aos fixos MOTIVO_VALIDADE_N2/N3 em src/lib/conformidade.js,
  -- pra separarMotivos() no cliente reconhecer normalmente.
  update local_estado_atual
  set motivo_nao_conformidade = trim(both ', ' from concat_ws(', ', nullif(motivo_nao_conformidade, ''), 'Validade Nível 2 vencida')),
      atualizado_em = now()
  where validade_nivel2 <= current_date
    and coalesce(motivo_nao_conformidade, '') not like '%Validade Nível 2 vencida%';

  update local_estado_atual
  set motivo_nao_conformidade = trim(both ', ' from concat_ws(', ', nullif(motivo_nao_conformidade, ''), 'Validade Nível 3 vencida')),
      atualizado_em = now()
  where validade_nivel3 <= current_date
    and coalesce(motivo_nao_conformidade, '') not like '%Validade Nível 3 vencida%';
end;
$$;

select cron.schedule('atualizar-conformidade-vencida', '0 3 * * *', 'select atualizar_conformidade_por_validade_vencida();');

-- ============================================================
-- Realtime: habilitar para as tabelas que a UI escuta ao vivo via
-- postgres_changes (Home, Dashboard, Situação, Histórico de Inspeções).
-- Sem isso na publicação, as telas não atualizam sozinhas quando outro
-- dispositivo grava algo — cada uma fica presa ao estado do carregamento.
-- ============================================================
-- ADD TABLE não aceita IF NOT EXISTS — rodar cada linha só uma vez (repetir
-- dá erro "already member of publication"). Esta lista documenta o estado
-- esperado da publicação; para uma tabela nova, adicionar uma linha aqui e
-- rodar só ela na migração.
alter publication supabase_realtime add table local_estado_atual;
alter publication supabase_realtime add table ordens_manutencao;
alter publication supabase_realtime add table configuracoes;
alter publication supabase_realtime add table historico_operacoes;
alter publication supabase_realtime add table trocas_planejadas;
alter publication supabase_realtime add table estoque_deposito;

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
