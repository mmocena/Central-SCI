import { useState } from 'react'
import { motivosNaoConformidade, textoObservacaoAutomatica, textoDetalhesFatores, textoTipoDivergente } from '../lib/conformidade'
import FatorChips, { OUTROS_ID, descricoesFatores } from './FatorChips'

const LABEL_SINALIZACAO_EXIGIDA = { parede: 'Parede', haste: 'Haste' }

function CampoColapsavel({ label, valor, aberto, onTrocar, children }) {
  if (valor && !aberto) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-slate-700">{label}</p>
        <div className="flex items-center gap-2">
          <span className="btn-option selected text-sm py-1.5 px-3">{valor}</span>
          <button onClick={onTrocar} className="text-xs text-sci-red font-medium underline">Trocar</button>
        </div>
      </div>
    )
  }
  return (
    <div className="space-y-2">
      <p className="text-sm text-slate-700">{label}</p>
      {children}
    </div>
  )
}

// Bloco de campos por extintor (usado no modo dual-slot)
function SlotBlock({ label, descricao, sinalizacaoExigida, tiposExtintor, fatores, fatoresSinalizacao, anosN3, form, setForm, editando, setEditando, sk }) {
  const tipoKgSel = tiposExtintor.find(t => t.tipo === form[`tipo_${sk}`] && String(t.kg) === String(form[`kg_${sk}`]))

  function set(campo, valor) { setForm(f => ({ ...f, [campo]: valor })) }

  function toggle(campoLista, id) {
    setForm(f => ({
      ...f,
      [campoLista]: f[campoLista].includes(id) ? f[campoLista].filter(x => x !== id) : [...f[campoLista], id]
    }))
  }

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 p-3 bg-slate-50">
      <p className="text-sm font-semibold text-sci-text">
        Extintor {label}{descricao ? <span className="font-normal text-slate-500"> — {descricao}</span> : ''}
      </p>

      {/* Tipo/kg */}
      <CampoColapsavel
        label="Tipo/kg:"
        valor={tipoKgSel ? `${tipoKgSel.tipo} ${tipoKgSel.kg}${tipoKgSel.unidade || 'kg'}` : ''}
        aberto={editando[`tipokg_${sk}`]}
        onTrocar={() => setEditando(e => ({ ...e, [`tipokg_${sk}`]: true }))}
      >
        <div className="flex flex-wrap gap-2">
          {tiposExtintor.map(t => (
            <button key={t.id} onClick={() => {
              set(`tipo_${sk}`, t.tipo); set(`kg_${sk}`, t.kg)
              setEditando(e => ({ ...e, [`tipokg_${sk}`]: false }))
            }} className="btn-option text-xs">
              {t.tipo} {t.kg}{t.unidade || 'kg'}
            </button>
          ))}
        </div>
      </CampoColapsavel>

      {/* Validade N2 */}
      <div className="space-y-2">
        <p className="text-sm text-slate-700">Validade N2:</p>
        <input type="month" value={form[`n2_${sk}`]} onChange={e => set(`n2_${sk}`, e.target.value)} />
      </div>

      {/* Validade N3 */}
      <CampoColapsavel
        label="Validade N3 (ano):"
        valor={form[`n3_${sk}`]}
        aberto={editando[`n3_${sk}`]}
        onTrocar={() => setEditando(e => ({ ...e, [`n3_${sk}`]: true }))}
      >
        <div className="flex flex-wrap gap-2">
          {anosN3.map(ano => (
            <button key={ano} onClick={() => {
              set(`n3_${sk}`, String(ano))
              setEditando(e => ({ ...e, [`n3_${sk}`]: false }))
            }} className="btn-option text-sm">{ano}</button>
          ))}
        </div>
      </CampoColapsavel>

      {/* Resultado */}
      <div className="space-y-2">
        <p className="text-sm text-slate-700">
          Resultado da inspeção:
          <span className="block text-xs text-slate-400 font-normal mt-0.5">
            Verifique manômetro, lacre, pino de segurança, mangueira e condição geral.
          </span>
        </p>
        <div className="flex gap-2">
          {['Operacional', 'Não Operacional'].map(v => (
            <button key={v}
              onClick={() => set(`operacional_${sk}`, v === 'Operacional')}
              className={`btn-option flex-1 text-sm ${form[`operacional_${sk}`] === (v === 'Operacional') ? 'selected' : ''}`}>
              {v}
            </button>
          ))}
        </div>
        {form[`operacional_${sk}`] === false && fatores.length > 0 && (
          <FatorChips
            label="Fator(es) não operacionais:"
            catalogo={fatores}
            selecionados={form[`fatores_nc_${sk}`]}
            textoOutro={form[`fator_outro_texto_${sk}`]}
            onToggle={id => toggle(`fatores_nc_${sk}`, id)}
            onTextoOutro={texto => set(`fator_outro_texto_${sk}`, texto)}
          />
        )}
      </div>

      {/* Sinalização (por slot — cada extintor pode ter tipo de sinalização exigido diferente) */}
      <div className="space-y-2">
        <p className="text-sm text-slate-700">
          Sinalização está conforme?
          <span className="block text-xs text-slate-400 font-normal mt-0.5">
            Verifique placa de sinalização, acesso desobstruído e identificação visível.
            {sinalizacaoExigida && <> Exigida: <strong>{LABEL_SINALIZACAO_EXIGIDA[sinalizacaoExigida]}</strong>.</>}
          </span>
        </p>
        <div className="flex gap-2">
          {['Sim', 'Não'].map(v => (
            <button key={v}
              onClick={() => set(`sinalizacao_ok_${sk}`, v === 'Sim')}
              className={`btn-option flex-1 ${form[`sinalizacao_ok_${sk}`] === (v === 'Sim') ? 'selected' : ''}`}>
              {v}
            </button>
          ))}
        </div>
        {form[`sinalizacao_ok_${sk}`] === false && fatoresSinalizacao.length > 0 && (
          <FatorChips
            label="Fator(es) de sinalização:"
            catalogo={fatoresSinalizacao}
            selecionados={form[`fatores_sinalizacao_${sk}`]}
            textoOutro={form[`fator_sinalizacao_outro_texto_${sk}`]}
            onToggle={id => toggle(`fatores_sinalizacao_${sk}`, id)}
            onTextoOutro={texto => set(`fator_sinalizacao_outro_texto_${sk}`, texto)}
          />
        )}
      </div>
    </div>
  )
}

export default function FormInspecao({
  local, slot, estadoAtual, tiposExtintor, fatores, fatoresSinalizacao, anosN3, equipes, titulo, onSubmit, bloqueado, textoRegistrar
}) {
  const temDoisSlots = local.tem_slot_a && local.tem_slot_b

  const [form, setForm] = useState(temDoisSlots ? {
    cap_ext_ok: null,
    tipo_a: '', kg_a: '', n2_a: '', n3_a: '', operacional_a: null, fatores_nc_a: [], fator_outro_texto_a: '',
    sinalizacao_ok_a: null, fatores_sinalizacao_a: [], fator_sinalizacao_outro_texto_a: '',
    tipo_b: '', kg_b: '', n2_b: '', n3_b: '', operacional_b: null, fatores_nc_b: [], fator_outro_texto_b: '',
    sinalizacao_ok_b: null, fatores_sinalizacao_b: [], fator_sinalizacao_outro_texto_b: '',
    observacoes: '', equipe: ''
  } : {
    cap_ext_ok: null,
    extintor_tipo: '', extintor_kg: '', cap_ext_atual: '',
    validade_nivel2: '', validade_nivel3: '', operacional: null, fatores_nc: [], fator_outro_texto: '',
    sinalizacao_ok: null, fatores_sinalizacao: [], fator_sinalizacao_outro_texto: '',
    observacoes: '', equipe: ''
  })

  const [editando, setEditando] = useState(temDoisSlots
    ? { tipokg_a: false, n3_a: false, tipokg_b: false, n3_b: false, equipe: false }
    : { tipokg: false, n3: false, equipe: false }
  )
  const [enviando, setEnviando] = useState(false)

  function set(campo, valor) { setForm(f => ({ ...f, [campo]: valor })) }

  function toggle(campoLista, id) {
    setForm(f => ({
      ...f,
      [campoLista]: f[campoLista].includes(id) ? f[campoLista].filter(x => x !== id) : [...f[campoLista], id]
    }))
  }

  // Motivos + texto automático de Observações, recalculados a cada resposta
  function motivosSlotDual(sk) {
    return motivosNaoConformidade({
      operacional: form[`operacional_${sk}`],
      sinalizacaoOk: form[`sinalizacao_ok_${sk}`],
      capExtOk: local.planta_cap_ext_exigida ? form.cap_ext_ok : undefined,
      validadeNivel2: form[`n2_${sk}`],
      validadeNivel3: form[`n3_${sk}`]
    })
  }

  function fatoresOperacionaisSlotDual(sk) {
    return descricoesFatores(fatores, form[`fatores_nc_${sk}`], form[`fator_outro_texto_${sk}`])
  }

  function fatoresSinalizacaoSlotDual(sk) {
    return descricoesFatores(fatoresSinalizacao, form[`fatores_sinalizacao_${sk}`], form[`fator_sinalizacao_outro_texto_${sk}`])
  }

  // Alerta de tipo divergente — não é motivo de não conformidade, só entra
  // no texto de Observações (ver comentário em motivosNaoConformidade).
  function textoTipoSlotDual(sk) {
    return textoTipoDivergente(form[`tipo_${sk}`], local.planta_tipo_exigido)
  }

  function textoAutoSlotDual(sk) {
    return [
      textoObservacaoAutomatica(motivosSlotDual(sk)),
      textoDetalhesFatores({ fatoresOperacionais: fatoresOperacionaisSlotDual(sk), fatoresSinalizacao: fatoresSinalizacaoSlotDual(sk) }),
      textoTipoSlotDual(sk)
    ].filter(Boolean).join(' ')
  }

  // ── Submit dual-slot ──
  async function handleSubmitDual() {
    if (!form.equipe) return alert('Selecione a equipe.')
    if (local.planta_cap_ext_exigida && form.cap_ext_ok === null) return alert('Informe a Capacidade Extintora conjunta.')
    if (form.operacional_a === null) return alert('Informe o resultado da inspeção do Extintor A.')
    if (form.operacional_a === false && fatores.length > 0 && form.fatores_nc_a.length === 0) return alert('Selecione ao menos um fator de não conformidade do Extintor A.')
    if (form.operacional_a === false && form.fatores_nc_a.includes(OUTROS_ID) && !form.fator_outro_texto_a.trim()) return alert('Descreva o motivo em "Outros" do Extintor A.')
    if (form.operacional_b === null) return alert('Informe o resultado da inspeção do Extintor B.')
    if (form.operacional_b === false && fatores.length > 0 && form.fatores_nc_b.length === 0) return alert('Selecione ao menos um fator de não conformidade do Extintor B.')
    if (form.operacional_b === false && form.fatores_nc_b.includes(OUTROS_ID) && !form.fator_outro_texto_b.trim()) return alert('Descreva o motivo em "Outros" do Extintor B.')
    if (form.sinalizacao_ok_a === null) return alert('Informe a situação da sinalização do Extintor A.')
    if (form.sinalizacao_ok_a === false && fatoresSinalizacao.length > 0 && form.fatores_sinalizacao_a.length === 0) return alert('Selecione ao menos um fator de sinalização do Extintor A.')
    if (form.sinalizacao_ok_a === false && form.fatores_sinalizacao_a.includes(OUTROS_ID) && !form.fator_sinalizacao_outro_texto_a.trim()) return alert('Descreva o motivo em "Outros" da sinalização do Extintor A.')
    if (form.sinalizacao_ok_b === null) return alert('Informe a situação da sinalização do Extintor B.')
    if (form.sinalizacao_ok_b === false && fatoresSinalizacao.length > 0 && form.fatores_sinalizacao_b.length === 0) return alert('Selecione ao menos um fator de sinalização do Extintor B.')
    if (form.sinalizacao_ok_b === false && form.fatores_sinalizacao_b.includes(OUTROS_ID) && !form.fator_sinalizacao_outro_texto_b.trim()) return alert('Descreva o motivo em "Outros" da sinalização do Extintor B.')

    const motivosA = motivosSlotDual('a')
    const motivosB = motivosSlotDual('b')
    const extra = form.observacoes.trim()

    const shared = { equipe: form.equipe, cap_ext_ok: form.cap_ext_ok }

    setEnviando(true)
    try {
      await onSubmit({
        isDual: true,
        slotA: {
          extintor_tipo: form.tipo_a, extintor_kg: form.kg_a,
          validade_nivel2: form.n2_a, validade_nivel3: form.n3_a,
          operacional: form.operacional_a, fatores_nc: form.fatores_nc_a,
          sinalizacao_ok: form.sinalizacao_ok_a,
          fatores_operacionais: fatoresOperacionaisSlotDual('a'),
          fatores_sinalizacao: fatoresSinalizacaoSlotDual('a'),
          motivo_nao_conformidade: motivosA.length ? motivosA.join(', ') : null,
          observacoes: [textoObservacaoAutomatica(motivosA), textoDetalhesFatores({ fatoresOperacionais: fatoresOperacionaisSlotDual('a'), fatoresSinalizacao: fatoresSinalizacaoSlotDual('a') }), textoTipoSlotDual('a'), extra].filter(Boolean).join(' '),
          reserva_empresa: false, ...shared
        },
        slotB: {
          extintor_tipo: form.tipo_b, extintor_kg: form.kg_b,
          validade_nivel2: form.n2_b, validade_nivel3: form.n3_b,
          operacional: form.operacional_b, fatores_nc: form.fatores_nc_b,
          sinalizacao_ok: form.sinalizacao_ok_b,
          fatores_operacionais: fatoresOperacionaisSlotDual('b'),
          fatores_sinalizacao: fatoresSinalizacaoSlotDual('b'),
          motivo_nao_conformidade: motivosB.length ? motivosB.join(', ') : null,
          observacoes: [textoObservacaoAutomatica(motivosB), textoDetalhesFatores({ fatoresOperacionais: fatoresOperacionaisSlotDual('b'), fatoresSinalizacao: fatoresSinalizacaoSlotDual('b') }), textoTipoSlotDual('b'), extra].filter(Boolean).join(' '),
          reserva_empresa: false, ...shared
        }
      })
    } catch (e) {
      alert('Erro ao registrar: ' + e.message)
    } finally {
      setEnviando(false)
    }
  }

  // ── Submit single-slot ──
  async function handleSubmit() {
    if (!form.equipe) return alert('Selecione a equipe.')
    if (local.planta_cap_ext_exigida && form.cap_ext_ok === null) return alert('Informe a Capacidade Extintora.')
    if (form.operacional === null) return alert('Informe o resultado da inspeção.')
    if (form.operacional === false && fatores.length > 0 && form.fatores_nc.length === 0) return alert('Selecione ao menos um fator de não conformidade.')
    if (form.operacional === false && form.fatores_nc.includes(OUTROS_ID) && !form.fator_outro_texto.trim()) return alert('Descreva o motivo em "Outros".')
    if (form.sinalizacao_ok === null) return alert('Informe a situação da sinalização.')
    if (form.sinalizacao_ok === false && fatoresSinalizacao.length > 0 && form.fatores_sinalizacao.length === 0) return alert('Selecione ao menos um fator de sinalização.')
    if (form.sinalizacao_ok === false && form.fatores_sinalizacao.includes(OUTROS_ID) && !form.fator_sinalizacao_outro_texto.trim()) return alert('Descreva o motivo em "Outros" da sinalização.')

    const motivos = motivosNaoConformidade({
      operacional: form.operacional,
      sinalizacaoOk: form.sinalizacao_ok,
      capExtOk: local.planta_cap_ext_exigida ? form.cap_ext_ok : undefined,
      validadeNivel2: form.validade_nivel2,
      validadeNivel3: form.validade_nivel3
    })
    const fatoresOperacionaisSelecionados = descricoesFatores(fatores, form.fatores_nc, form.fator_outro_texto)
    const fatoresSinalizacaoSelecionados = descricoesFatores(fatoresSinalizacao, form.fatores_sinalizacao, form.fator_sinalizacao_outro_texto)
    const motivo_nao_conformidade = motivos.length > 0 ? motivos.join(', ') : null
    const textoTipo = textoTipoDivergente(form.extintor_tipo, local.planta_tipo_exigido)
    const observacoes = [
      textoObservacaoAutomatica(motivos),
      textoDetalhesFatores({ fatoresOperacionais: fatoresOperacionaisSelecionados, fatoresSinalizacao: fatoresSinalizacaoSelecionados }),
      textoTipo,
      form.observacoes.trim()
    ].filter(Boolean).join(' ')

    setEnviando(true)
    try {
      await onSubmit({
        ...form,
        observacoes,
        reserva_empresa: estadoAtual?.reserva_empresa ?? false,
        motivo_nao_conformidade,
        fatores_operacionais: fatoresOperacionaisSelecionados,
        fatores_sinalizacao: fatoresSinalizacaoSelecionados
      })
    } catch (e) {
      alert('Erro ao registrar: ' + e.message)
    } finally {
      setEnviando(false)
    }
  }

  const tipoKgSelecionado = tiposExtintor.find(
    t => t.tipo === form.extintor_tipo && String(t.kg) === String(form.extintor_kg)
  )

  // ════════════════════════════════════════
  // DUAL-SLOT FORM
  // ════════════════════════════════════════
  if (temDoisSlots) {
    const textoAutoA = textoAutoSlotDual('a')
    const textoAutoB = textoAutoSlotDual('b')

    return (
      <div className="card space-y-5">
        <p className="text-sm font-bold text-sci-text border-b border-sci-border pb-2">{titulo}</p>

        {bloqueado && (
          <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
            Informe seu nome para registrar inspeções.
          </div>
        )}

        {/* Alerta dual-slot */}
        <div className="text-xs bg-blue-50 border border-blue-200 text-blue-800 rounded-xl px-3 py-2 leading-relaxed">
          Este local possui <strong>dois extintores</strong> que, em conjunto, atendem à Capacidade Extintora exigida pela planta. Preencha os dados de cada um separadamente. As validades e o resultado de operacionalidade são avaliados individualmente — a condição mais crítica define a conformidade do local.
        </div>

        {/* 1. Cap.Ext. conjunta */}
        {local.planta_cap_ext_exigida && (
          <div className="space-y-2">
            <p className="text-sm text-slate-700">
              1. Os extintores juntos possuem Capacidade Extintora igual ou superior a{' '}
              <strong className="text-sci-text">{local.planta_cap_ext_exigida}</strong>?
            </p>
            <div className="flex gap-2">
              {['Sim', 'Não'].map(v => (
                <button key={v}
                  onClick={() => set('cap_ext_ok', v === 'Sim')}
                  className={`btn-option flex-1 ${form.cap_ext_ok === (v === 'Sim') ? 'selected' : ''}`}>
                  {v}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Bloco Extintor A */}
        <SlotBlock label="A" descricao={local.descricao_slot_a} sinalizacaoExigida={local.sinalizacao_exigida_a}
          tiposExtintor={tiposExtintor} fatores={fatores} fatoresSinalizacao={fatoresSinalizacao} anosN3={anosN3}
          form={form} setForm={setForm} editando={editando} setEditando={setEditando} sk="a" />

        {/* Bloco Extintor B */}
        <SlotBlock label="B" descricao={local.descricao_slot_b} sinalizacaoExigida={local.sinalizacao_exigida_b}
          tiposExtintor={tiposExtintor} fatores={fatores} fatoresSinalizacao={fatoresSinalizacao} anosN3={anosN3}
          form={form} setForm={setForm} editando={editando} setEditando={setEditando} sk="b" />

        {/* 7. Observações */}
        <div className="space-y-2">
          <p className="text-sm text-slate-700">7. Observações:</p>
          {(textoAutoA || textoAutoB) && (
            <div className="space-y-1">
              {textoAutoA && (
                <p className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-600">
                  <span className="font-semibold">A:</span> {textoAutoA}
                </p>
              )}
              {textoAutoB && (
                <p className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-600">
                  <span className="font-semibold">B:</span> {textoAutoB}
                </p>
              )}
            </div>
          )}
          <textarea
            value={form.observacoes}
            onChange={e => set('observacoes', e.target.value)}
            placeholder="Escreva mais detalhes aqui, se necessário."
            rows={2}
            className="resize-none"
          />
        </div>

        {/* 8. Equipe */}
        <CampoColapsavel
          label="8. Equipe:"
          valor={form.equipe}
          aberto={editando.equipe}
          onTrocar={() => setEditando(e => ({ ...e, equipe: true }))}
        >
          <div className="grid grid-cols-4 gap-2">
            {equipes.map(eq => (
              <button key={eq}
                onClick={() => { set('equipe', eq); setEditando(e => ({ ...e, equipe: false })) }}
                className="btn-option text-sm font-semibold">{eq}</button>
            ))}
          </div>
        </CampoColapsavel>

        <button
          onClick={handleSubmitDual}
          disabled={bloqueado || enviando}
          className="btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {enviando ? 'Registrando...' : (textoRegistrar || 'Registrar Inspeção')}
        </button>
      </div>
    )
  }

  // ════════════════════════════════════════
  // SINGLE-SLOT FORM (original)
  // ════════════════════════════════════════
  const fatoresOperacionaisAtuais = descricoesFatores(fatores, form.fatores_nc, form.fator_outro_texto)
  const fatoresSinalizacaoAtuais = descricoesFatores(fatoresSinalizacao, form.fatores_sinalizacao, form.fator_sinalizacao_outro_texto)
  const textoAuto = [
    textoObservacaoAutomatica(motivosNaoConformidade({
      operacional: form.operacional,
      sinalizacaoOk: form.sinalizacao_ok,
      capExtOk: local.planta_cap_ext_exigida ? form.cap_ext_ok : undefined,
      validadeNivel2: form.validade_nivel2,
      validadeNivel3: form.validade_nivel3
    })),
    textoDetalhesFatores({ fatoresOperacionais: fatoresOperacionaisAtuais, fatoresSinalizacao: fatoresSinalizacaoAtuais }),
    textoTipoDivergente(form.extintor_tipo, local.planta_tipo_exigido)
  ].filter(Boolean).join(' ')

  return (
    <div className="card space-y-5">
      <p className="text-sm font-bold text-sci-text border-b border-sci-border pb-2">{titulo}</p>

      {bloqueado && (
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
          Informe seu nome para registrar inspeções.
        </div>
      )}

      {/* 1. Cap.Ext. */}
      {local.planta_cap_ext_exigida && (
        <div className="space-y-2">
          <p className="text-sm text-slate-700">
            1. O extintor possui Capacidade Extintora igual ou superior a{' '}
            <strong className="text-sci-text">{local.planta_cap_ext_exigida}</strong>?
          </p>
          <div className="flex gap-2">
            {['Sim', 'Não'].map(v => (
              <button key={v}
                onClick={() => set('cap_ext_ok', v === 'Sim')}
                className={`btn-option flex-1 ${form.cap_ext_ok === (v === 'Sim') ? 'selected' : ''}`}>
                {v}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 2. Tipo/kg */}
      <CampoColapsavel
        label="2. Tipo/kg do extintor:"
        valor={tipoKgSelecionado ? `${tipoKgSelecionado.tipo} ${tipoKgSelecionado.kg}${tipoKgSelecionado.unidade || 'kg'}` : ''}
        aberto={editando.tipokg}
        onTrocar={() => setEditando(e => ({ ...e, tipokg: true }))}
      >
        <div className="flex flex-wrap gap-2">
          {tiposExtintor.map(t => (
            <button key={t.id}
              onClick={() => { set('extintor_tipo', t.tipo); set('extintor_kg', t.kg); setEditando(e => ({ ...e, tipokg: false })) }}
              className="btn-option text-xs">
              {t.tipo} {t.kg}{t.unidade || 'kg'}
            </button>
          ))}
        </div>
      </CampoColapsavel>

      {/* 3. Validade N2 */}
      <div className="space-y-2">
        <p className="text-sm text-slate-700">3. Validade Nível 2:</p>
        <input type="month" value={form.validade_nivel2} onChange={e => set('validade_nivel2', e.target.value)} />
      </div>

      {/* 4. Validade N3 */}
      <CampoColapsavel
        label="4. Validade Nível 3 (ano):"
        valor={form.validade_nivel3}
        aberto={editando.n3}
        onTrocar={() => setEditando(e => ({ ...e, n3: true }))}
      >
        <div className="flex flex-wrap gap-2">
          {anosN3.map(ano => (
            <button key={ano}
              onClick={() => { set('validade_nivel3', String(ano)); setEditando(e => ({ ...e, n3: false })) }}
              className="btn-option text-sm">{ano}</button>
          ))}
        </div>
      </CampoColapsavel>

      {/* 5. Resultado */}
      <div className="space-y-2">
        <p className="text-sm text-slate-700">
          5. Resultado da inspeção:
          <span className="block text-xs text-slate-400 font-normal mt-0.5">
            Verifique manômetro, lacre, pino de segurança, mangueira e condição geral do cilindro.
          </span>
        </p>
        <div className="flex gap-2">
          {['Operacional', 'Não Operacional'].map(v => (
            <button key={v}
              onClick={() => set('operacional', v === 'Operacional')}
              className={`btn-option flex-1 text-sm ${form.operacional === (v === 'Operacional') ? 'selected' : ''}`}>
              {v}
            </button>
          ))}
        </div>
        {form.operacional === false && fatores.length > 0 && (
          <FatorChips
            label="Fator(es) não operacionais:"
            catalogo={fatores}
            selecionados={form.fatores_nc}
            textoOutro={form.fator_outro_texto}
            onToggle={id => toggle('fatores_nc', id)}
            onTextoOutro={texto => set('fator_outro_texto', texto)}
          />
        )}
      </div>

      {/* 6. Sinalização */}
      <div className="space-y-2">
        <p className="text-sm text-slate-700">
          6. Sinalização está conforme?
          <span className="block text-xs text-slate-400 font-normal mt-0.5">
            Verifique placa de sinalização, acesso desobstruído e identificação visível.
            {local.sinalizacao_exigida_a && <> Exigida: <strong>{LABEL_SINALIZACAO_EXIGIDA[local.sinalizacao_exigida_a]}</strong>.</>}
          </span>
        </p>
        <div className="flex gap-2">
          {['Sim', 'Não'].map(v => (
            <button key={v}
              onClick={() => set('sinalizacao_ok', v === 'Sim')}
              className={`btn-option flex-1 ${form.sinalizacao_ok === (v === 'Sim') ? 'selected' : ''}`}>
              {v}
            </button>
          ))}
        </div>
        {form.sinalizacao_ok === false && fatoresSinalizacao.length > 0 && (
          <FatorChips
            label="Fator(es) de sinalização:"
            catalogo={fatoresSinalizacao}
            selecionados={form.fatores_sinalizacao}
            textoOutro={form.fator_sinalizacao_outro_texto}
            onToggle={id => toggle('fatores_sinalizacao', id)}
            onTextoOutro={texto => set('fator_sinalizacao_outro_texto', texto)}
          />
        )}
      </div>

      {/* 7. Observações */}
      <div className="space-y-2">
        <p className="text-sm text-slate-700">7. Observações:</p>
        {textoAuto && (
          <p className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-600">
            {textoAuto}
          </p>
        )}
        <textarea
          value={form.observacoes}
          onChange={e => set('observacoes', e.target.value)}
          placeholder="Escreva mais detalhes aqui, se necessário."
          rows={2}
          className="resize-none"
        />
      </div>

      {/* 8. Equipe */}
      <CampoColapsavel
        label="8. Equipe:"
        valor={form.equipe}
        aberto={editando.equipe}
        onTrocar={() => setEditando(e => ({ ...e, equipe: true }))}
      >
        <div className="grid grid-cols-4 gap-2">
          {equipes.map(eq => (
            <button key={eq}
              onClick={() => { set('equipe', eq); setEditando(e => ({ ...e, equipe: false })) }}
              className="btn-option text-sm font-semibold">{eq}</button>
          ))}
        </div>
      </CampoColapsavel>

      <button
        onClick={handleSubmit}
        disabled={bloqueado || enviando}
        className="btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {enviando ? 'Registrando...' : (textoRegistrar || 'Registrar Inspeção')}
      </button>
    </div>
  )
}
