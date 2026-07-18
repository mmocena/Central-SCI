import { supabase } from './supabase'
import { enfileirar } from './offlineQueue'

export async function fetchLocaisComEstado() {
  const { data, error } = await supabase
    .from('locais')
    .select(`
      *,
      local_estado_atual (*)
    `)
    .eq('ativo', true)
    .order('numero')

  if (error) throw error
  return data
}

export async function fetchTiposExtintor() {
  const { data, error } = await supabase
    .from('tipos_extintor')
    .select('*')
    .eq('ativo', true)
    .order('tipo')

  if (error) throw error
  return data
}

export async function fetchFatoresNaoOperacionalidade() {
  const { data, error } = await supabase
    .from('fatores_nao_operacionalidade')
    .select('*')
    .eq('ativo', true)
    .order('ordem')

  if (error) throw error
  return data
}

export async function fetchHistoricoInspecoes() {
  const { data, error } = await supabase
    .from('historico_operacoes')
    .select('*, locais(numero, edificacao, descricao, planta_tipo_exigido, planta_cap_ext_exigida, tem_slot_a, tem_slot_b)')
    .eq('modo', 'inspecao')
    .order('data_operacao', { ascending: false })

  if (error) throw error
  return data || []
}

const CHAVE_INICIO_PERIODO = 'inicio_periodo_inspecao'

// Marca o início do período de vistoria atual. Sem essa configuração
// (nunca resetado), qualquer inspeção já feita conta como dentro do período.
export async function fetchInicioPeriodoInspecao() {
  const { data, error } = await supabase
    .from('configuracoes')
    .select('valor')
    .eq('chave', CHAVE_INICIO_PERIODO)
    .maybeSingle()

  if (error) throw error
  return data?.valor ?? null
}

export async function resetarPeriodoInspecao() {
  const { error } = await supabase
    .from('configuracoes')
    .upsert({ chave: CHAVE_INICIO_PERIODO, valor: new Date().toISOString() }, { onConflict: 'chave' })
  if (error) throw error
}

// ────────────────────────────────────────────────────────────────
// Fila offline: se a rede cair no meio de uma gravação, a operação
// é salva no IndexedDB e reenviada automaticamente ao reconectar.
// Cada operação carrega um client_op_id gerado no clique — ao reenviar,
// as funções internas (_registrarX) checam se esse id já foi gravado
// antes de duplicar qualquer INSERT.
// ────────────────────────────────────────────────────────────────

// supabase-js não deixa o TypeError bruto do fetch escapar — ele embrulha em
// { message, details, code } via postgrest-js. Por isso checamos os dois formatos.
// Exportado porque o replay da fila (syncOffline.js) precisa da mesma checagem.
export function isErroDeRede(err) {
  if (err instanceof TypeError) return true
  const texto = `${err?.message || ''} ${err?.details || ''}`
  return /failed to fetch|load failed|networkerror|fetch failed/i.test(texto)
}

async function executarOuEnfileirar(tipo, args, execFn) {
  try {
    await execFn(args)
    return { queued: false }
  } catch (err) {
    if (isErroDeRede(err)) {
      await enfileirar(tipo, args)
      return { queued: true }
    }
    throw err
  }
}

// registrar_inspecao (RPC) grava histórico + estado atual numa única transação
// no Postgres — nada de passo intermediário visível de fora, então não existe
// janela onde só uma das duas gravações aconteceu.
async function _registrarInspecao({ localId, slot, responsavel, equipe, payload, conformidade, clientOpId }) {
  const { error } = await supabase.rpc('registrar_inspecao', {
    p_local_id: localId,
    p_slot: slot,
    p_responsavel: responsavel,
    p_equipe: equipe,
    p_payload: { ...payload, conformidade },
    p_conformidade: conformidade,
    p_client_op_id: clientOpId,
    p_extintor_tipo: payload.extintor_tipo,
    p_extintor_kg: payload.extintor_kg || null,
    p_cap_ext_atual: payload.cap_ext_atual || null,
    p_reserva_empresa: payload.reserva_empresa ?? false,
    p_motivo_nao_conformidade: payload.motivo_nao_conformidade ?? null,
    p_observacoes: payload.observacoes ?? null,
    p_validade_nivel2: payload.validade_nivel2 ? payload.validade_nivel2 + '-01' : null,
    p_validade_nivel3: payload.validade_nivel3 ? payload.validade_nivel3 + '-12-01' : null
  })
  if (error) throw error
}

export async function registrarInspecao(args) {
  const clientOpId = args.clientOpId ?? crypto.randomUUID()
  return executarOuEnfileirar('registrarInspecao', { ...args, clientOpId }, _registrarInspecao)
}

// registrar_envio_manutencao (RPC) cria a ordem, o histórico, atualiza o
// estado do local e desconta o depósito numa única transação — o desconto de
// estoque nunca fica "pendurado" separado da criação da ordem.
async function _registrarEnvioManutencao({ localId, slot, responsavel, equipe, envio, inspecao, conformidade, clientOpId }) {
  const isReserva = envio.substituto_origem === 'RESERVA_DEPOSITO' || envio.substituto_origem === 'RESERVA_NOVO'
  const descontaEstoque = envio.substituto_origem === 'SCI' || envio.substituto_origem === 'RESERVA_DEPOSITO'
  const categoria = envio.substituto_origem === 'SCI' ? 'SCI' : 'RESERVA'

  const { error } = await supabase.rpc('registrar_envio_manutencao', {
    p_local_id: localId,
    p_slot: slot,
    p_responsavel: responsavel,
    p_equipe: equipe,
    p_client_op_id: clientOpId,
    p_extintor_saiu_tipo: envio.tipo_saiu,
    p_extintor_saiu_kg: envio.kg_saiu || null,
    p_nivel_manutencao: parseInt(envio.nivel_manutencao),
    p_substituto_tipo: inspecao.extintor_tipo,
    p_substituto_kg: inspecao.extintor_kg || null,
    p_substituto_cap_ext: inspecao.cap_ext_atual || null,
    p_substituto_reserva: isReserva,
    p_substituto_origem: envio.substituto_origem,
    p_substituto_operacional: inspecao.operacional ?? true,
    p_payload: { ...inspecao, ...envio },
    p_conformidade: conformidade,
    p_motivo_nao_conformidade: inspecao.motivo_nao_conformidade ?? null,
    p_validade_nivel2: inspecao.validade_nivel2 ? inspecao.validade_nivel2 + '-01' : null,
    p_validade_nivel3: inspecao.validade_nivel3 ? inspecao.validade_nivel3 + '-12-01' : null,
    p_desconta_estoque: descontaEstoque,
    p_estoque_categoria: categoria
  })
  if (error) throw error
}

export async function registrarEnvioManutencao(args) {
  const clientOpId = args.clientOpId ?? crypto.randomUUID()
  return executarOuEnfileirar('registrarEnvioManutencao', { ...args, clientOpId }, _registrarEnvioManutencao)
}

export async function fetchEstoqueDeposito() {
  const { data, error } = await supabase
    .from('estoque_deposito')
    .select('*')
    .order('categoria')
    .order('tipo')
    .order('kg')
  if (error) throw error
  return data || []
}

// Incremento/decremento por 1 — se essa chamada for reenviada da fila
// offline, o pior caso é aplicar o delta 2x (contagem errada por 1 unidade,
// corrigível na próxima conferência física). Aceitável dado o baixo risco.
async function _ajustarEstoqueDeposito({ tipo, kg, categoria, operacional = true, delta }) {
  const { data } = await supabase
    .from('estoque_deposito')
    .select('id, quantidade')
    .eq('tipo', tipo).eq('kg', parseFloat(kg)).eq('categoria', categoria).eq('operacional', operacional)
    .single()
  if (!data) return
  const nova = Math.max(0, data.quantidade + delta)
  const { error } = await supabase.from('estoque_deposito')
    .update({ quantidade: nova, atualizado_em: new Date().toISOString() })
    .eq('id', data.id)
  if (error) throw error
}

export async function ajustarEstoqueDeposito(args) {
  return executarOuEnfileirar('ajustarEstoqueDeposito', args, _ajustarEstoqueDeposito)
}

// upsert com ignoreDuplicates na chave natural (tipo,kg,categoria,operacional)
// — reenviar da fila não duplica.
async function _upsertItemDeposito({ tipo, kg, categoria, operacional = true }) {
  const { error } = await supabase
    .from('estoque_deposito')
    .upsert(
      { tipo, kg: parseFloat(kg), categoria, operacional, atualizado_em: new Date().toISOString() },
      { onConflict: 'tipo,kg,categoria,operacional', ignoreDuplicates: true }
    )
  if (error) throw error
}

export async function upsertItemDeposito(args) {
  return executarOuEnfileirar('upsertItemDeposito', args, _upsertItemDeposito)
}

// delete por id é idempotente — apagar de novo um id já apagado não dá erro.
async function _excluirItemDeposito(id) {
  const { error } = await supabase.from('estoque_deposito').delete().eq('id', id)
  if (error) throw error
}

export async function excluirItemDeposito(id) {
  return executarOuEnfileirar('excluirItemDeposito', id, _excluirItemDeposito)
}

export async function fetchLocaisComReserva() {
  const { data: estados, error: e1 } = await supabase
    .from('local_estado_atual')
    .select('local_id')
    .eq('reserva_empresa', true)

  if (e1) throw e1
  if (!estados?.length) return []

  const ids = estados.map(e => e.local_id)
  const { data, error: e2 } = await supabase
    .from('locais')
    .select('*, local_estado_atual(*)')
    .in('id', ids)
    .eq('ativo', true)
    .order('numero')

  if (e2) throw e2
  return data || []
}

// registrar_envio_estoque (RPC): checa o lote e insere as N unidades na mesma
// transação, sem janela entre o "já existe?" e o insert.
async function _registrarEnvioEstoque({ tipo, kg, nivel, quantidade, responsavel, equipe, clientOpId }) {
  const { error } = await supabase.rpc('registrar_envio_estoque', {
    p_tipo: tipo,
    p_kg: parseFloat(kg),
    p_nivel: parseInt(nivel),
    p_quantidade: quantidade,
    p_responsavel: responsavel,
    p_equipe: equipe,
    p_lote_id: clientOpId
  })
  if (error) throw error
}

export async function registrarEnvioEstoque(args) {
  const clientOpId = args.clientOpId ?? crypto.randomUUID()
  return executarOuEnfileirar('registrarEnvioEstoque', { ...args, clientOpId }, _registrarEnvioEstoque)
}

// registrar_recebimento_ordem (RPC): fecha a ordem + histórico + estado do
// local numa única transação por ordem.
async function _registrarRecebimentoMassa({ ordens, responsavel, equipe, clientOpIds }) {
  await Promise.all(ordens.map(async (ordem, i) => {
    const { error } = await supabase.rpc('registrar_recebimento_ordem', {
      p_ordem_id: ordem.id,
      p_responsavel: responsavel,
      p_equipe: equipe,
      p_client_op_id: clientOpIds[i],
      p_local_id: ordem.local_id ?? null,
      p_slot: ordem.slot ?? null
    })
    if (error) throw error
  }))
}

export async function registrarRecebimentoMassa({ ordens, responsavel, equipe, clientOpIds }) {
  const ids = clientOpIds ?? ordens.map(() => crypto.randomUUID())
  return executarOuEnfileirar(
    'registrarRecebimentoMassa',
    { ordens, responsavel, equipe, clientOpIds: ids },
    _registrarRecebimentoMassa
  )
}

async function _marcarReserva({ localId, slot, valor }) {
  const { error } = await supabase
    .from('local_estado_atual')
    .upsert({ local_id: localId, slot, reserva_empresa: valor }, { onConflict: 'local_id,slot' })
  if (error) throw error
}

export async function marcarReserva(args) {
  return executarOuEnfileirar('marcarReserva', args, _marcarReserva)
}

// Mapa usado pelo replay da fila offline (src/lib/syncOffline.js) — sempre
// chama a versão interna (_xxx), nunca o wrapper público, senão um item que
// falhar de novo por falta de rede voltaria a se enfileirar dentro do próprio replay.
export const HANDLERS_FILA = {
  registrarInspecao: _registrarInspecao,
  registrarEnvioManutencao: _registrarEnvioManutencao,
  registrarEnvioEstoque: _registrarEnvioEstoque,
  registrarRecebimentoMassa: _registrarRecebimentoMassa,
  marcarReserva: _marcarReserva,
  ajustarEstoqueDeposito: _ajustarEstoqueDeposito,
  upsertItemDeposito: _upsertItemDeposito,
  excluirItemDeposito: _excluirItemDeposito,
  salvarRegistroAdmin: _salvarRegistroAdmin,
  atualizarCampoAdmin: _atualizarCampoAdmin,
  excluirRegistroAdmin: _excluirRegistroAdmin,
  definirTrocaPlanejada: _definirTrocaPlanejada,
  cancelarTrocaPlanejada: _cancelarTrocaPlanejada,
}

// ────────────────────────────────────────────────────────────────
// CRUD genérico do Admin (locais, tipos_extintor, fatores_nao_operacionalidade)
// — três operações cobrem os 9 pontos de escrita das telas de Admin,
// todas passando pela mesma fila offline.
// ────────────────────────────────────────────────────────────────

async function _salvarRegistroAdmin({ tabela, id, payload }) {
  const { error } = id
    ? await supabase.from(tabela).update(payload).eq('id', id)
    : await supabase.from(tabela).insert(payload)
  if (error) throw error
}

export async function salvarRegistroAdmin(args) {
  return executarOuEnfileirar('salvarRegistroAdmin', args, _salvarRegistroAdmin)
}

async function _atualizarCampoAdmin({ tabela, id, campos }) {
  const { error } = await supabase.from(tabela).update(campos).eq('id', id)
  if (error) throw error
}

export async function atualizarCampoAdmin(args) {
  return executarOuEnfileirar('atualizarCampoAdmin', args, _atualizarCampoAdmin)
}

async function _excluirRegistroAdmin({ tabela, id }) {
  const { error } = await supabase.from(tabela).delete().eq('id', id)
  if (error) throw error
}

export async function excluirRegistroAdmin(args) {
  return executarOuEnfileirar('excluirRegistroAdmin', args, _excluirRegistroAdmin)
}

export async function verificarSenhaAdmin(senha) {
  const encoder = new TextEncoder()
  const data = encoder.encode(senha)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashHex = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('')

  const { data: row, error } = await supabase
    .from('configuracoes')
    .select('valor')
    .eq('chave', 'senha_admin')
    .single()

  if (error || !row) return false
  return row.valor === hashHex
}

export async function fetchLocaisComVencimento() {
  const ano = String(new Date().getFullYear())

  const { data: estados, error: e1 } = await supabase
    .from('local_estado_atual')
    .select('local_id, slot, validade_nivel2, validade_nivel3')

  if (e1) throw e1

  const comVencimento = (estados || []).filter(e =>
    (e.validade_nivel2 && e.validade_nivel2.startsWith(ano)) ||
    (e.validade_nivel3 && e.validade_nivel3.startsWith(ano))
  )

  if (!comVencimento.length) return []

  const ids = [...new Set(comVencimento.map(e => e.local_id))]

  const { data: locais, error: e2 } = await supabase
    .from('locais')
    .select('*, local_estado_atual(*)')
    .in('id', ids)
    .eq('ativo', true)
    .order('numero')

  if (e2) throw e2

  return (locais || []).map(local => {
    const slotsDados = comVencimento.filter(e => e.local_id === local.id)
    const vencimentos = slotsDados.map(e => {
      const n3ok = e.validade_nivel3?.startsWith(ano)
      const n2ok = e.validade_nivel2?.startsWith(ano)
      return {
        slot: e.slot,
        nivel: n3ok ? 3 : 2,
        validade: n3ok ? e.validade_nivel3 : e.validade_nivel2
      }
    })
    return { ...local, vencimentos }
  })
}

// Ordens de manutenção ainda pendentes (aguardando recebimento) — fonte de
// verdade pra "quantos extintores estão em manutenção agora", já que o local
// em si não guarda mais esse vínculo (ver registrar_envio_manutencao).
export async function fetchOrdensPendentes() {
  const { data, error } = await supabase
    .from('ordens_manutencao')
    .select('*, locais(id, numero, edificacao, descricao, planta_tipo_exigido, planta_cap_ext_exigida, tem_slot_a, tem_slot_b)')
    .eq('status', 'PENDENTE')
    .order('data_saida', { ascending: false })

  if (error) throw error
  return data || []
}

// ────────────────────────────────────────────────────────────────
// Plano de trocas de Tipo entre locais/estoque (guia Não Conformidades) —
// só sugestão, nunca executa nada sozinho. Ver trocas_planejadas no schema.
// ────────────────────────────────────────────────────────────────

export async function fetchTrocasPlanejadas() {
  const { data, error } = await supabase
    .from('trocas_planejadas')
    .select(`
      *,
      origem_local:locais!trocas_planejadas_origem_local_id_fkey(id, numero, edificacao),
      origem_estoque:estoque_deposito(id, tipo, kg, categoria)
    `)

  if (error) throw error
  return data || []
}

// insert simples — a unicidade de (local_id,slot) e da origem já é
// garantida pelo banco; um conflito aqui vira erro visível na hora
// (não é algo pra tentar de novo silenciosamente depois).
async function _definirTrocaPlanejada({ localId, slot, origemTipo, origemLocalId, origemSlot, origemEstoqueId, responsavel }) {
  const { error } = await supabase.from('trocas_planejadas').insert({
    local_id: localId,
    slot,
    origem_tipo: origemTipo,
    origem_local_id: origemLocalId ?? null,
    origem_slot: origemSlot ?? null,
    origem_estoque_id: origemEstoqueId ?? null,
    definido_por: responsavel
  })
  if (error) throw error
}

export async function definirTrocaPlanejada(args) {
  return executarOuEnfileirar('definirTrocaPlanejada', args, _definirTrocaPlanejada)
}

async function _cancelarTrocaPlanejada(id) {
  const { error } = await supabase.from('trocas_planejadas').delete().eq('id', id)
  if (error) throw error
}

export async function cancelarTrocaPlanejada(id) {
  return executarOuEnfileirar('cancelarTrocaPlanejada', id, _cancelarTrocaPlanejada)
}
