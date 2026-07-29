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

export async function fetchFatoresSinalizacao() {
  const { data, error } = await supabase
    .from('fatores_sinalizacao_nao_conforme')
    .select('*')
    .eq('ativo', true)
    .order('ordem')

  if (error) throw error
  return data
}

// ────────────────────────────────────────────────────────────────
// Setor Hidrantes/Mangueiras — Camada 1 (cadastro base). Leituras usadas
// por quem consome essas listas fora da própria tela de cadastro (ex:
// pickers de tipo/hidrante/CCI em outros formulários) — a listagem
// ativos+inativos de cada aba do cadastro em si consulta o Supabase
// direto no componente, mesmo padrão já usado em Admin.jsx.
// ────────────────────────────────────────────────────────────────

export async function fetchTiposMangueira() {
  const { data, error } = await supabase
    .from('tipos_mangueira')
    .select('*')
    .eq('ativo', true)
    .order('diametro')

  if (error) throw error
  return data
}

export async function fetchHidrantes() {
  const { data, error } = await supabase
    .from('hidrantes')
    .select('*')
    .eq('ativo', true)
    .order('numero')

  if (error) throw error
  return data
}

export async function fetchCcis() {
  const { data, error } = await supabase
    .from('ccis')
    .select('*')
    .eq('ativo', true)
    .order('numero')

  if (error) throw error
  return data
}

// localTipo: 'HIDRANTE' | 'CCI'
export async function fetchDotacaoMangueira(localTipo, localId) {
  const coluna = localTipo === 'HIDRANTE' ? 'hidrante_id' : 'cci_id'
  const { data, error } = await supabase
    .from('dotacao_mangueira')
    .select('*, tipos_mangueira(tipo, diametro, comprimento)')
    .eq('local_tipo', localTipo)
    .eq(coluna, localId)

  if (error) throw error
  return data
}

// Dotação de todos os CCIs de uma vez — usado pra calcular sobra dos CCIs
// em RT nas sugestões de realocação (candidatosParaCci em trocasMangueira.js).
export async function fetchDotacaoMangueiraTodosCcis() {
  const { data, error } = await supabase
    .from('dotacao_mangueira')
    .select('cci_id, tipo_mangueira_id, quantidade_exigida')
    .eq('local_tipo', 'CCI')

  if (error) throw error
  const porCci = {}
  for (const row of data || []) {
    if (!porCci[row.cci_id]) porCci[row.cci_id] = []
    porCci[row.cci_id].push(row)
  }
  return porCci
}

export async function fetchMangueiras() {
  const { data, error } = await supabase
    .from('mangueiras')
    .select('*, tipos_mangueira(tipo, diametro, comprimento), hidrantes(numero, edificacao), ccis(numero, placa)')
    .eq('ativo', true)
    .order('identificacao')

  if (error) throw error
  return data
}

// Catálogos de fatores da vistoria (Camada 2) — mesmo padrão de
// fetchFatoresNaoOperacionalidade/fetchFatoresSinalizacao.
export async function fetchFatoresIntegridadeMangueira() {
  const { data, error } = await supabase.from('fatores_integridade_mangueira').select('*').eq('ativo', true).order('ordem')
  if (error) throw error
  return data
}

export async function fetchFatoresEsguicho() {
  const { data, error } = await supabase.from('fatores_esguicho_nao_conforme').select('*').eq('ativo', true).order('ordem')
  if (error) throw error
  return data
}

export async function fetchFatoresChaveMangueira() {
  const { data, error } = await supabase.from('fatores_chave_mangueira_nao_conforme').select('*').eq('ativo', true).order('ordem')
  if (error) throw error
  return data
}

export async function fetchFatoresIntegridadeCaixaHidrante() {
  const { data, error } = await supabase.from('fatores_integridade_caixa_hidrante').select('*').eq('ativo', true).order('ordem')
  if (error) throw error
  return data
}

// salvar_dotacao_mangueira (RPC) apaga e recria a dotação inteira do
// hidrante/CCI numa transação só — evita ficar com dotação parcialmente salva.
async function _salvarDotacaoMangueira({ localTipo, localId, itens }) {
  const { error } = await supabase.rpc('salvar_dotacao_mangueira', {
    p_local_tipo: localTipo,
    p_local_id: localId,
    p_itens: itens.map(i => ({ tipo_mangueira_id: i.tipoMangueiraId, quantidade: i.quantidade }))
  })
  if (error) throw error
}

export async function salvarDotacaoMangueira(args) {
  return executarOuEnfileirar('salvarDotacaoMangueira', args, _salvarDotacaoMangueira)
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
    p_validade_nivel3: payload.validade_nivel3 ? payload.validade_nivel3 + '-12-01' : null,
    p_fatores_operacionais: payload.fatores_operacionais?.length ? payload.fatores_operacionais : null,
    p_fatores_sinalizacao: payload.fatores_sinalizacao?.length ? payload.fatores_sinalizacao : null
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
    p_estoque_categoria: categoria,
    p_fatores_operacionais: inspecao.fatores_operacionais?.length ? inspecao.fatores_operacionais : null,
    p_fatores_sinalizacao: inspecao.fatores_sinalizacao?.length ? inspecao.fatores_sinalizacao : null
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
async function _registrarEnvioEstoque({ tipo, kg, nivel, quantidade, responsavel, equipe, categoria, clientOpId }) {
  const { error } = await supabase.rpc('registrar_envio_estoque', {
    p_tipo: tipo,
    p_kg: parseFloat(kg),
    p_nivel: nivel ? parseInt(nivel) : null,
    p_quantidade: quantidade,
    p_responsavel: responsavel,
    p_equipe: equipe,
    p_lote_id: clientOpId,
    p_categoria: categoria
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

// ────────────────────────────────────────────────────────────────
// Setor Hidrantes/Mangueiras — Camada 2 (vistoria). Mesmo padrão de
// historico + upsert de estado numa transação só, idempotente via
// client_op_id, já usado em registrar_inspecao pros extintores.
// ────────────────────────────────────────────────────────────────

async function _registrarVistoriaMangueira({ mangueiraId, responsavel, equipe, clientOpId, integridadeOk, fatoresIntegridade, conformidade, observacoes, payload }) {
  const { error } = await supabase.rpc('registrar_vistoria_mangueira', {
    p_mangueira_id: mangueiraId,
    p_responsavel: responsavel,
    p_equipe: equipe,
    p_client_op_id: clientOpId,
    p_integridade_ok: integridadeOk,
    p_fatores_integridade: fatoresIntegridade?.length ? fatoresIntegridade : null,
    p_conformidade: conformidade,
    p_observacoes: observacoes ?? null,
    p_payload: payload ?? {}
  })
  if (error) throw error
}

export async function registrarVistoriaMangueira(args) {
  const clientOpId = args.clientOpId ?? crypto.randomUUID()
  return executarOuEnfileirar('registrarVistoriaMangueira', { ...args, clientOpId }, _registrarVistoriaMangueira)
}

async function _registrarVistoriaHidrante({ hidranteId, responsavel, equipe, clientOpId, esguichoOk, fatoresEsguicho, chaveOk, fatoresChave, caixaOk, fatoresCaixa, sinalizacaoOk, fatoresSinalizacao, conformidade, motivoNaoConformidade, observacoes, payload }) {
  const { error } = await supabase.rpc('registrar_vistoria_hidrante', {
    p_hidrante_id: hidranteId,
    p_responsavel: responsavel,
    p_equipe: equipe,
    p_client_op_id: clientOpId,
    p_esguicho_ok: esguichoOk,
    p_fatores_esguicho: fatoresEsguicho?.length ? fatoresEsguicho : null,
    p_chave_ok: chaveOk,
    p_fatores_chave: fatoresChave?.length ? fatoresChave : null,
    p_caixa_ok: caixaOk,
    p_fatores_caixa: fatoresCaixa?.length ? fatoresCaixa : null,
    p_sinalizacao_ok: sinalizacaoOk,
    p_fatores_sinalizacao: fatoresSinalizacao?.length ? fatoresSinalizacao : null,
    p_conformidade: conformidade,
    p_motivo_nao_conformidade: motivoNaoConformidade ?? null,
    p_observacoes: observacoes ?? null,
    p_payload: payload ?? {}
  })
  if (error) throw error
}

export async function registrarVistoriaHidrante(args) {
  const clientOpId = args.clientOpId ?? crypto.randomUUID()
  return executarOuEnfileirar('registrarVistoriaHidrante', { ...args, clientOpId }, _registrarVistoriaHidrante)
}

async function _registrarVistoriaCci({ cciId, responsavel, equipe, clientOpId, conformidade, observacoes, payload }) {
  const { error } = await supabase.rpc('registrar_vistoria_cci', {
    p_cci_id: cciId,
    p_responsavel: responsavel,
    p_equipe: equipe,
    p_client_op_id: clientOpId,
    p_conformidade: conformidade,
    p_observacoes: observacoes ?? null,
    p_payload: payload ?? {}
  })
  if (error) throw error
}

export async function registrarVistoriaCci(args) {
  const clientOpId = args.clientOpId ?? crypto.randomUUID()
  return executarOuEnfileirar('registrarVistoriaCci', { ...args, clientOpId }, _registrarVistoriaCci)
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
  definirTrocaMangueiraPlanejada: _definirTrocaMangueiraPlanejada,
  cancelarTrocaMangueiraPlanejada: _cancelarTrocaMangueiraPlanejada,
  salvarDotacaoMangueira: _salvarDotacaoMangueira,
  registrarVistoriaMangueira: _registrarVistoriaMangueira,
  registrarVistoriaHidrante: _registrarVistoriaHidrante,
  registrarVistoriaCci: _registrarVistoriaCci,
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
  // Vencidos (de qualquer ano) ou a vencer até o fim do ano vigente — datas
  // em formato ISO (YYYY-MM-DD) comparam certo como string. RESERVA fica de
  // fora: não são extintores nossos, são da empresa que faz a manutenção.
  const fimAnoAtual = `${new Date().getFullYear()}-12-31`

  const { data: estados, error: e1 } = await supabase
    .from('local_estado_atual')
    .select('local_id, slot, validade_nivel2, validade_nivel3, reserva_empresa')

  if (e1) throw e1

  const comVencimento = (estados || []).filter(e =>
    !e.reserva_empresa &&
    ((e.validade_nivel2 && e.validade_nivel2 <= fimAnoAtual) ||
     (e.validade_nivel3 && e.validade_nivel3 <= fimAnoAtual))
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

  const comDados = (locais || []).map(local => {
    const slotsDados = comVencimento.filter(e => e.local_id === local.id)
    const vencimentos = slotsDados.map(e => {
      const n3ok = e.validade_nivel3 && e.validade_nivel3 <= fimAnoAtual
      const n2ok = e.validade_nivel2 && e.validade_nivel2 <= fimAnoAtual
      return {
        slot: e.slot,
        nivel: n3ok ? 3 : 2,
        validade: n3ok ? e.validade_nivel3 : e.validade_nivel2
      }
    })
    return { ...local, vencimentos }
  })

  // Do mais vencido pro mais distante de vencer — cada local ordenado pela
  // validade mais antiga entre seus vencimentos.
  return comDados.sort((a, b) => {
    const minA = Math.min(...a.vencimentos.map(v => new Date(v.validade)))
    const minB = Math.min(...b.vencimentos.map(v => new Date(v.validade)))
    return minA - minB
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

// ────────────────────────────────────────────────────────────────
// Plano de realocação de mangueira pra um CCI em linha (setor
// Hidrantes/Mangueiras) — mesmo espírito acima, sem reciprocidade. Ver
// trocas_mangueira_planejadas e o trigger de limpeza automática no schema.
// ────────────────────────────────────────────────────────────────

export async function fetchTrocasMangueiraPlanejadas() {
  const { data, error } = await supabase
    .from('trocas_mangueira_planejadas')
    .select(`
      *,
      cci_destino:ccis(id, numero, placa),
      mangueira:mangueiras(id, identificacao, tipo_mangueira_id, cci_id, ccis(numero, placa))
    `)

  if (error) throw error
  return data || []
}

async function _definirTrocaMangueiraPlanejada({ cciDestinoId, mangueiraId, responsavel }) {
  const { error } = await supabase.from('trocas_mangueira_planejadas').insert({
    cci_destino_id: cciDestinoId,
    mangueira_id: mangueiraId,
    definido_por: responsavel
  })
  if (error) throw error
}

export async function definirTrocaMangueiraPlanejada(args) {
  return executarOuEnfileirar('definirTrocaMangueiraPlanejada', args, _definirTrocaMangueiraPlanejada)
}

async function _cancelarTrocaMangueiraPlanejada(id) {
  const { error } = await supabase.from('trocas_mangueira_planejadas').delete().eq('id', id)
  if (error) throw error
}

export async function cancelarTrocaMangueiraPlanejada(id) {
  return executarOuEnfileirar('cancelarTrocaMangueiraPlanejada', id, _cancelarTrocaMangueiraPlanejada)
}
