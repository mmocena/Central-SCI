import { useState } from 'react'

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
function SlotBlock({ label, descricao, tiposExtintor, fatores, anosN3, form, setForm, editando, setEditando, sk }) {
  const tipoKgSel = tiposExtintor.find(t => t.tipo === form[`tipo_${sk}`] && String(t.kg) === String(form[`kg_${sk}`]))

  function set(campo, valor) { setForm(f => ({ ...f, [campo]: valor })) }

  function toggleFator(id) {
    const key = `fatores_nc_${sk}`
    setForm(f => ({
      ...f,
      [key]: f[key].includes(id) ? f[key].filter(x => x !== id) : [...f[key], id]
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
        valor={tipoKgSel ? `${tipoKgSel.tipo} ${tipoKgSel.kg}kg` : ''}
        aberto={editando[`tipokg_${sk}`]}
        onTrocar={() => setEditando(e => ({ ...e, [`tipokg_${sk}`]: true }))}
      >
        <div className="flex flex-wrap gap-2">
          {tiposExtintor.map(t => (
            <button key={t.id} onClick={() => {
              set(`tipo_${sk}`, t.tipo); set(`kg_${sk}`, t.kg)
              setEditando(e => ({ ...e, [`tipokg_${sk}`]: false }))
            }} className="btn-option text-xs">
              {t.tipo} {t.kg}kg
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
          <div className="mt-2 space-y-2 pl-3 border-l-2 border-red-200">
            <p className="text-xs text-slate-500 font-medium">Fator(es) não operacionais:</p>
            {fatores.map(f => {
              const sel = form[`fatores_nc_${sk}`].includes(f.id)
              return (
                <button key={f.id} onClick={() => toggleFator(f.id)} className="flex items-center gap-2 w-full text-left">
                  <div className={`shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${sel ? 'border-sci-red bg-sci-red' : 'border-slate-300 bg-white'}`}>
                    {sel && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                  <span className="text-sm text-slate-700 flex-1">{f.descricao}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default function FormInspecao({
  local, slot, estadoAtual, tiposExtintor, fatores, anosN3, equipes, titulo, onSubmit, bloqueado, textoRegistrar
}) {
  const temDoisSlots = local.tem_slot_a && local.tem_slot_b

  const [form, setForm] = useState(temDoisSlots ? {
    cap_ext_ok: null,
    tipo_a: '', kg_a: '', n2_a: '', n3_a: '', operacional_a: null, fatores_nc_a: [],
    tipo_b: '', kg_b: '', n2_b: '', n3_b: '', operacional_b: null, fatores_nc_b: [],
    sinalizacao_ok: null, observacoes: '', equipe: ''
  } : {
    cap_ext_ok: null,
    extintor_tipo: '', extintor_kg: '', cap_ext_atual: '',
    validade_nivel2: '', validade_nivel3: '', operacional: null, fatores_nc: [],
    sinalizacao_ok: null, observacoes: '', equipe: ''
  })

  const [editando, setEditando] = useState(temDoisSlots
    ? { tipokg_a: false, n3_a: false, tipokg_b: false, n3_b: false, equipe: false }
    : { tipokg: false, n3: false, equipe: false }
  )
  const [enviando, setEnviando] = useState(false)

  function set(campo, valor) { setForm(f => ({ ...f, [campo]: valor })) }

  function toggleFator(id) {
    setForm(f => ({
      ...f,
      fatores_nc: f.fatores_nc.includes(id) ? f.fatores_nc.filter(x => x !== id) : [...f.fatores_nc, id]
    }))
  }

  // ── Submit dual-slot ──
  async function handleSubmitDual() {
    if (!form.equipe) return alert('Selecione a equipe.')
    if (local.planta_cap_ext_exigida && form.cap_ext_ok === null) return alert('Informe a Capacidade Extintora conjunta.')
    if (form.operacional_a === null) return alert('Informe o resultado da inspeção do Extintor A.')
    if (form.operacional_b === null) return alert('Informe o resultado da inspeção do Extintor B.')
    if (form.sinalizacao_ok === null) return alert('Informe a situação da sinalização.')
    if (form.sinalizacao_ok === false && !form.observacoes.trim()) return alert('Descreva a não conformidade da sinalização no campo Observações.')

    const shared = { sinalizacao_ok: form.sinalizacao_ok, observacoes: form.observacoes, equipe: form.equipe, cap_ext_ok: form.cap_ext_ok }

    const motivosA = fatores.filter(f => form.fatores_nc_a.includes(f.id)).map(f => f.descricao)
    const motivosB = fatores.filter(f => form.fatores_nc_b.includes(f.id)).map(f => f.descricao)
    if (form.sinalizacao_ok === false) { motivosA.push('Sinalização'); motivosB.push('Sinalização') }

    setEnviando(true)
    try {
      await onSubmit({
        isDual: true,
        slotA: {
          extintor_tipo: form.tipo_a, extintor_kg: form.kg_a,
          validade_nivel2: form.n2_a, validade_nivel3: form.n3_a,
          operacional: form.operacional_a, fatores_nc: form.fatores_nc_a,
          motivo_nao_conformidade: motivosA.length ? motivosA.join(', ') : null,
          reserva_empresa: false, ...shared
        },
        slotB: {
          extintor_tipo: form.tipo_b, extintor_kg: form.kg_b,
          validade_nivel2: form.n2_b, validade_nivel3: form.n3_b,
          operacional: form.operacional_b, fatores_nc: form.fatores_nc_b,
          motivo_nao_conformidade: motivosB.length ? motivosB.join(', ') : null,
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
    if (form.operacional === null) return alert('Informe o resultado da inspeção.')
    if (form.sinalizacao_ok === null) return alert('Informe a situação da sinalização.')
    if (form.sinalizacao_ok === false && !form.observacoes.trim()) return alert('Descreva a não conformidade da sinalização no campo Observações.')

    const motivos = []
    if (form.cap_ext_ok === false) motivos.push('Capacidade Extintora reduzida')
    if (form.operacional === false && form.fatores_nc.length > 0) {
      motivos.push(...fatores.filter(f => form.fatores_nc.includes(f.id)).map(f => f.descricao))
    }
    if (form.sinalizacao_ok === false) motivos.push('Sinalização')
    const motivo_nao_conformidade = motivos.length > 0 ? motivos.join(', ') : null

    setEnviando(true)
    try {
      await onSubmit({ ...form, reserva_empresa: estadoAtual?.reserva_empresa ?? false, motivo_nao_conformidade })
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
        <SlotBlock label="A" descricao={local.descricao_slot_a} tiposExtintor={tiposExtintor} fatores={fatores} anosN3={anosN3}
          form={form} setForm={setForm} editando={editando} setEditando={setEditando} sk="a" />

        {/* Bloco Extintor B */}
        <SlotBlock label="B" descricao={local.descricao_slot_b} tiposExtintor={tiposExtintor} fatores={fatores} anosN3={anosN3}
          form={form} setForm={setForm} editando={editando} setEditando={setEditando} sk="b" />

        {/* 6. Sinalização (compartilhada) */}
        <div className="space-y-2">
          <p className="text-sm text-slate-700">
            6. Sinalização está conforme?
            <span className="block text-xs text-slate-400 font-normal mt-0.5">
              Verifique placa de sinalização, acesso desobstruído e identificação visível.
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
        </div>

        {/* 7. Observações */}
        <div className="space-y-2">
          <p className="text-sm text-slate-700">
            7. Observações:
            {form.sinalizacao_ok === false && (
              <span className="text-red-600 font-medium"> *obrigatório</span>
            )}
          </p>
          <textarea
            value={form.observacoes}
            onChange={e => set('observacoes', e.target.value)}
            placeholder="Descreva não conformidades, informações de acesso, melhorias ou outras informações."
            rows={3}
            className={`resize-none ${form.sinalizacao_ok === false && !form.observacoes.trim() ? 'border-red-400 focus:border-red-500 focus:ring-red-200' : ''}`}
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
        valor={tipoKgSelecionado ? `${tipoKgSelecionado.tipo} ${tipoKgSelecionado.kg}kg` : ''}
        aberto={editando.tipokg}
        onTrocar={() => setEditando(e => ({ ...e, tipokg: true }))}
      >
        <div className="flex flex-wrap gap-2">
          {tiposExtintor.map(t => (
            <button key={t.id}
              onClick={() => { set('extintor_tipo', t.tipo); set('extintor_kg', t.kg); setEditando(e => ({ ...e, tipokg: false })) }}
              className="btn-option text-xs">
              {t.tipo} {t.kg}kg
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
          <div className="mt-2 space-y-2 pl-3 border-l-2 border-red-200">
            <p className="text-xs text-slate-500 font-medium">Fator(es) não operacionais:</p>
            {fatores.map(f => {
              const selecionado = form.fatores_nc.includes(f.id)
              return (
                <button key={f.id} onClick={() => toggleFator(f.id)} className="flex items-center gap-2 w-full text-left">
                  <div className={`shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${selecionado ? 'border-sci-red bg-sci-red' : 'border-slate-300 bg-white'}`}>
                    {selecionado && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                  <span className="text-sm text-slate-700 flex-1">{f.descricao}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* 6. Sinalização */}
      <div className="space-y-2">
        <p className="text-sm text-slate-700">
          6. Sinalização está conforme?
          <span className="block text-xs text-slate-400 font-normal mt-0.5">
            Verifique placa de sinalização, acesso desobstruído e identificação visível.
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
      </div>

      {/* 7. Observações */}
      <div className="space-y-2">
        <p className="text-sm text-slate-700">
          7. Observações:
          {form.sinalizacao_ok === false && (
            <span className="text-red-600 font-medium"> *obrigatório</span>
          )}
        </p>
        <textarea
          value={form.observacoes}
          onChange={e => set('observacoes', e.target.value)}
          placeholder="Descreva não conformidades, informações de acesso, melhorias ou outras informações."
          rows={3}
          className={`resize-none ${form.sinalizacao_ok === false && !form.observacoes.trim() ? 'border-red-400 focus:border-red-500 focus:ring-red-200' : ''}`}
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
