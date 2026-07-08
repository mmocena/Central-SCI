import { supabase } from './supabase'

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
    .select('*, locais(numero, edificacao, descricao, planta_tipo_exigido, planta_cap_ext_exigida)')
    .eq('modo', 'inspecao')
    .order('data_operacao', { ascending: false })

  if (error) throw error
  return data || []
}

export async function registrarInspecao({ localId, slot, responsavel, equipe, payload, conformidade }) {
  const agora = new Date().toISOString()

  const [{ error: errHist }, { error: errEstado }] = await Promise.all([
    supabase.from('historico_operacoes').insert({
      modo: 'inspecao',
      local_id: localId,
      slot,
      data_operacao: agora,
      responsavel,
      equipe,
      payload: { ...payload, conformidade }
    }),
    supabase.from('local_estado_atual').upsert({
      local_id: localId,
      slot,
      extintor_tipo: payload.extintor_tipo,
      extintor_kg: payload.extintor_kg,
      cap_ext_atual: payload.cap_ext_atual,
      reserva_empresa: payload.reserva_empresa ?? false,
      situacao_conformidade: conformidade,
      motivo_nao_conformidade: payload.motivo_nao_conformidade ?? null,
      observacoes: payload.observacoes ?? null,
      validade_nivel2: payload.validade_nivel2 ? payload.validade_nivel2 + '-01' : null,
      validade_nivel3: payload.validade_nivel3 ? payload.validade_nivel3 + '-12-01' : null,
      data_ultima_inspecao: agora,
      responsavel_ultima_inspecao: responsavel,
      equipe_ultima_inspecao: equipe,
      atualizado_em: agora
    }, { onConflict: 'local_id,slot' })
  ])

  if (errHist) throw errHist
  if (errEstado) throw errEstado
}

export async function registrarEnvioManutencao({ localId, slot, responsavel, equipe, envio, inspecao, conformidade }) {
  const agora = new Date().toISOString()
  const isReserva = envio.substituto_origem === 'RESERVA_DEPOSITO' || envio.substituto_origem === 'RESERVA_NOVO'

  const { data: ordem, error: errOrdem } = await supabase
    .from('ordens_manutencao')
    .insert({
      local_id: localId,
      slot,
      extintor_saiu_tipo: envio.tipo_saiu,
      extintor_saiu_kg: envio.kg_saiu,
      nivel_manutencao: parseInt(envio.nivel_manutencao),
      substituto_tipo: inspecao.extintor_tipo,
      substituto_kg: inspecao.extintor_kg,
      substituto_cap_ext: inspecao.cap_ext_atual,
      substituto_reserva: isReserva,
      substituto_origem: envio.substituto_origem,
      substituto_operacional: inspecao.operacional ?? true,
      data_saida: agora,
      responsavel_saida: responsavel,
      equipe_saida: equipe
    })
    .select('id')
    .single()

  if (errOrdem) throw errOrdem

  const [{ error: errHist }, { error: errEstado }] = await Promise.all([
    supabase.from('historico_operacoes').insert({
      modo: 'logistica_envio',
      local_id: localId,
      slot,
      ordem_manutencao_id: ordem.id,
      data_operacao: agora,
      responsavel,
      equipe,
      payload: { ...inspecao, ...envio }
    }),
    supabase.from('local_estado_atual').upsert({
      local_id: localId,
      slot,
      extintor_tipo: inspecao.extintor_tipo,
      extintor_kg: inspecao.extintor_kg,
      cap_ext_atual: inspecao.cap_ext_atual,
      reserva_empresa: isReserva,
      situacao_conformidade: conformidade,
      motivo_nao_conformidade: inspecao.motivo_nao_conformidade ?? null,
      em_manutencao: true,
      ordem_manutencao_id: ordem.id,
      validade_nivel2: inspecao.validade_nivel2 ? inspecao.validade_nivel2 + '-01' : null,
      validade_nivel3: inspecao.validade_nivel3 ? inspecao.validade_nivel3 + '-12-01' : null,
      data_ultima_logistica: agora,
      responsavel_ultima_logistica: responsavel,
      equipe_ultima_logistica: equipe,
      atualizado_em: agora
    }, { onConflict: 'local_id,slot' })
  ])

  if (errHist) throw errHist
  if (errEstado) throw errEstado

  // Desconto automático do depósito
  if (envio.substituto_origem === 'SCI' || envio.substituto_origem === 'RESERVA_DEPOSITO') {
    const categoria = envio.substituto_origem === 'SCI' ? 'SCI' : 'RESERVA'
    await ajustarEstoqueDeposito({ tipo: inspecao.extintor_tipo, kg: inspecao.extintor_kg, categoria, delta: -1 })
  }
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

export async function ajustarEstoqueDeposito({ tipo, kg, categoria, operacional = true, delta }) {
  const { data } = await supabase
    .from('estoque_deposito')
    .select('id, quantidade')
    .eq('tipo', tipo).eq('kg', parseFloat(kg)).eq('categoria', categoria).eq('operacional', operacional)
    .single()
  if (!data) return
  const nova = Math.max(0, data.quantidade + delta)
  await supabase.from('estoque_deposito')
    .update({ quantidade: nova, atualizado_em: new Date().toISOString() })
    .eq('id', data.id)
}

export async function upsertItemDeposito({ tipo, kg, categoria, operacional = true }) {
  const { error } = await supabase
    .from('estoque_deposito')
    .upsert(
      { tipo, kg: parseFloat(kg), categoria, operacional, atualizado_em: new Date().toISOString() },
      { onConflict: 'tipo,kg,categoria,operacional', ignoreDuplicates: true }
    )
  if (error) throw error
}

export async function excluirItemDeposito(id) {
  const { error } = await supabase.from('estoque_deposito').delete().eq('id', id)
  if (error) throw error
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

export async function registrarEnvioEstoque({ tipo, kg, nivel, quantidade, responsavel, equipe }) {
  const agora = new Date().toISOString()

  const inserts = Array.from({ length: quantidade }, () => ({
    local_id: null,
    slot: null,
    extintor_saiu_tipo: tipo,
    extintor_saiu_kg: parseFloat(kg),
    nivel_manutencao: parseInt(nivel),
    substituto_reserva: false,
    data_saida: agora,
    responsavel_saida: responsavel,
    equipe_saida: equipe
  }))

  const { error } = await supabase.from('ordens_manutencao').insert(inserts)
  if (error) throw error
}

export async function registrarRecebimentoMassa({ ordens, responsavel, equipe }) {
  const agora = new Date().toISOString()

  await Promise.all(ordens.map(async (ordem) => {
    const ops = [
      supabase.from('ordens_manutencao').update({
        status: 'CONCLUIDA',
        data_retorno: agora,
        responsavel_retorno: responsavel,
        equipe_retorno: equipe,
        extintor_retornou_para: 'ESTOQUE'
      }).eq('id', ordem.id),
    ]

    // Ordens do estoque (local_id null) não têm local_estado_atual nem historico com local
    if (ordem.local_id) {
      ops.push(
        supabase.from('historico_operacoes').insert({
          modo: 'logistica_retorno',
          local_id: ordem.local_id,
          slot: ordem.slot,
          ordem_manutencao_id: ordem.id,
          data_operacao: agora,
          responsavel,
          equipe,
          payload: { destino: 'ESTOQUE' }
        }),
        supabase.from('local_estado_atual').update({
          em_manutencao: false,
          ordem_manutencao_id: null,
          atualizado_em: agora
        }).eq('local_id', ordem.local_id).eq('slot', ordem.slot)
      )
    }

    const results = await Promise.all(ops)
    for (const { error } of results) {
      if (error) throw error
    }
  }))
}

export async function registrarRetornoManutencao({ localId, slot, responsavel, equipe, ordemId, destino, inspecao, conformidade }) {
  const agora = new Date().toISOString()

  const [{ error: errOrdem }, { error: errHist }, { error: errEstado }] = await Promise.all([
    supabase.from('ordens_manutencao').update({
      status: 'CONCLUIDA',
      data_retorno: agora,
      responsavel_retorno: responsavel,
      equipe_retorno: equipe,
      extintor_retornou_para: destino
    }).eq('id', ordemId),

    supabase.from('historico_operacoes').insert({
      modo: 'logistica_retorno',
      local_id: localId,
      slot,
      ordem_manutencao_id: ordemId,
      data_operacao: agora,
      responsavel,
      equipe,
      payload: { ...inspecao, destino }
    }),

    supabase.from('local_estado_atual').upsert({
      local_id: localId,
      slot,
      extintor_tipo: inspecao.extintor_tipo,
      extintor_kg: inspecao.extintor_kg,
      cap_ext_atual: inspecao.cap_ext_atual,
      reserva_empresa: false,
      situacao_conformidade: conformidade,
      motivo_nao_conformidade: inspecao.motivo_nao_conformidade ?? null,
      em_manutencao: false,
      ordem_manutencao_id: null,
      validade_nivel2: inspecao.validade_nivel2 ? inspecao.validade_nivel2 + '-01' : null,
      validade_nivel3: inspecao.validade_nivel3 ? inspecao.validade_nivel3 + '-12-01' : null,
      data_ultima_logistica: agora,
      responsavel_ultima_logistica: responsavel,
      equipe_ultima_logistica: equipe,
      atualizado_em: agora
    }, { onConflict: 'local_id,slot' })
  ])

  if (errOrdem) throw errOrdem
  if (errHist) throw errHist
  if (errEstado) throw errEstado
}

export async function marcarReserva({ localId, slot, valor }) {
  const { error } = await supabase
    .from('local_estado_atual')
    .upsert({ local_id: localId, slot, reserva_empresa: valor }, { onConflict: 'local_id,slot' })
  if (error) throw error
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
    .neq('em_manutencao', true)

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
