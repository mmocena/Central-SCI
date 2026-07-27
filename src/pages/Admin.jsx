import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { salvarRegistroAdmin, atualizarCampoAdmin, excluirRegistroAdmin } from '../lib/queries'
import { useToast, avisarResultado } from '../components/Toast'
import TelaLoginAdmin, { SESSION_KEY } from '../components/TelaLoginAdmin'

function ToggleSinalizacao({ valor, onChange }) {
  return (
    <div className="flex gap-2">
      {['parede', 'haste'].map(v => (
        <button key={v} type="button" onClick={() => onChange(v)}
          className={`btn-option flex-1 text-sm ${valor === v ? 'selected' : ''}`}>
          {v === 'parede' ? 'Parede' : 'Haste'}
        </button>
      ))}
    </div>
  )
}

export default function Admin() {
  const [autenticado, setAutenticado] = useState(() => sessionStorage.getItem(SESSION_KEY) === '1')
  const [aba, setAba] = useState('locais')

  if (!autenticado) return <TelaLoginAdmin />

  return (
    <div className="p-4 space-y-4">
      <div className="flex gap-2">
        {['locais', 'tipos', 'fatores'].map(a => (
          <button
            key={a}
            onClick={() => setAba(a)}
            className={`btn-option text-xs capitalize ${aba === a ? 'selected' : ''}`}
          >
            {a === 'locais' ? 'Locais' : a === 'tipos' ? 'Tipos de Extintor' : 'Fatores NC'}
          </button>
        ))}
      </div>

      {aba === 'locais' && <AdminLocais />}
      {aba === 'tipos' && <AdminTipos />}
      {aba === 'fatores' && <AdminFatores />}
    </div>
  )
}

function AdminLocais() {
  const showToast = useToast()
  const [locais, setLocais] = useState([])
  const [tipos, setTipos] = useState([])
  const [form, setForm] = useState({
    numero: '', edificacao: '', descricao: '',
    tem_slot_a: true, tem_slot_b: false,
    descricao_slot_a: '', descricao_slot_b: '',
    planta_tipo_exigido: '', planta_cap_ext_exigida: '',
    sinalizacao_exigida_a: '', sinalizacao_exigida_b: ''
  })
  const [salvando, setSalvando] = useState(false)
  const [editandoId, setEditandoId] = useState(null)
  const [formAberto, setFormAberto] = useState(false)

  useEffect(() => { carregar() }, [])

  async function carregar() {
    const [{ data: ls }, { data: ts }] = await Promise.all([
      supabase.from('locais').select('*').eq('ativo', true).order('numero'),
      supabase.from('tipos_extintor').select('tipo').eq('ativo', true)
    ])
    setLocais(ls || [])
    setTipos(ts || [])
  }

  const edificacoesUnicas = [...new Set(locais.map(l => l.edificacao).filter(Boolean))].sort()
  const tiposUnicos = [...new Set(tipos.map(t => t.tipo).filter(Boolean))].sort()
  const capExtUnicas = [...new Set(locais.map(l => l.planta_cap_ext_exigida).filter(Boolean))].sort()

  function editarLocal(l) {
    setFormAberto(true)
    setEditandoId(l.id)
    setForm({
      numero: String(l.numero),
      edificacao: l.edificacao,
      descricao: l.descricao || '',
      tem_slot_a: l.tem_slot_a,
      tem_slot_b: l.tem_slot_b,
      descricao_slot_a: l.descricao_slot_a || '',
      descricao_slot_b: l.descricao_slot_b || '',
      planta_tipo_exigido: l.planta_tipo_exigido || '',
      planta_cap_ext_exigida: l.planta_cap_ext_exigida || '',
      sinalizacao_exigida_a: l.sinalizacao_exigida_a || '',
      sinalizacao_exigida_b: l.sinalizacao_exigida_b || ''
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelarEdicao() {
    setEditandoId(null)
    setFormAberto(false)
    setForm({
      numero: '', edificacao: '', descricao: '', tem_slot_a: true, tem_slot_b: false,
      descricao_slot_a: '', descricao_slot_b: '', planta_tipo_exigido: '', planta_cap_ext_exigida: '',
      sinalizacao_exigida_a: '', sinalizacao_exigida_b: ''
    })
  }

  async function salvar() {
    if (!form.numero || !form.edificacao) return alert('Número e Edificação são obrigatórios.')
    setSalvando(true)
    const payload = {
      numero: parseInt(form.numero),
      edificacao: form.edificacao.trim(),
      descricao: form.descricao.trim() || null,
      tem_slot_a: form.tem_slot_a,
      tem_slot_b: form.tem_slot_b,
      descricao_slot_a: form.tem_slot_b ? (form.descricao_slot_a.trim() || null) : null,
      descricao_slot_b: form.tem_slot_b ? (form.descricao_slot_b.trim() || null) : null,
      planta_tipo_exigido: form.planta_tipo_exigido.trim() || null,
      planta_cap_ext_exigida: form.planta_cap_ext_exigida.trim().toUpperCase() || null,
      sinalizacao_exigida_a: form.sinalizacao_exigida_a || null,
      sinalizacao_exigida_b: form.tem_slot_b ? (form.sinalizacao_exigida_b || null) : null
    }
    let resultado
    try {
      resultado = await salvarRegistroAdmin({ tabela: 'locais', id: editandoId, payload })
    } catch (e) {
      setSalvando(false)
      return alert('Erro: ' + e.message)
    }
    setSalvando(false)
    avisarResultado(showToast, resultado, editandoId ? 'Local atualizado com sucesso.' : 'Local cadastrado com sucesso.')
    cancelarEdicao()
    await carregar()
  }

  return (
    <div className="space-y-4">

      {!formAberto && (
        <button onClick={() => setFormAberto(true)} className="btn-primary w-full">+ Novo Local</button>
      )}

      {formAberto && (
      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-sci-text">{editandoId ? 'Editar Local' : 'Novo Local'}</p>
          <button onClick={cancelarEdicao} className="text-xs text-slate-400 underline">Cancelar</button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-slate-400">Número *</label>
            <input type="number" value={form.numero} onChange={e => setForm(f => ({ ...f, numero: e.target.value }))}
              className="w-full mt-1" />
          </div>
          <div>
            <label className="text-xs text-sci-muted">Edificação *</label>
            <input type="text" list="dl-edificacoes" value={form.edificacao} onChange={e => setForm(f => ({ ...f, edificacao: e.target.value }))}
              className="w-full mt-1" />
            <datalist id="dl-edificacoes">
              {edificacoesUnicas.map(e => <option key={e} value={e} />)}
            </datalist>
          </div>
        </div>
        <div>
          <label className="text-xs text-sci-muted">Descrição / Localização</label>
          <input type="text" value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
            placeholder="ex: Corredor térreo, chave na guarita"
            className="w-full mt-1" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-sci-muted">Tipo exigido (Planta)</label>
            <input type="text" list="dl-tipos-planta" value={form.planta_tipo_exigido} onChange={e => setForm(f => ({ ...f, planta_tipo_exigido: e.target.value }))}
              placeholder="ex: CO²"
              className="w-full mt-1" />
            <datalist id="dl-tipos-planta">
              {tiposUnicos.map(t => <option key={t} value={t} />)}
            </datalist>
          </div>
          <div>
            <label className="text-xs text-sci-muted">Cap.Ext. exigida (Planta)</label>
            <input type="text" list="dl-capext" value={form.planta_cap_ext_exigida} onChange={e => setForm(f => ({ ...f, planta_cap_ext_exigida: e.target.value }))}
              placeholder="ex: 5-B:C"
              className="w-full mt-1" />
            <datalist id="dl-capext">
              {capExtUnicas.map(c => <option key={c} value={c} />)}
            </datalist>
          </div>
        </div>

        {!form.tem_slot_b && (
          <div className="space-y-1">
            <label className="text-xs text-sci-muted">Tipo de Sinalização</label>
            <ToggleSinalizacao valor={form.sinalizacao_exigida_a} onChange={v => setForm(f => ({ ...f, sinalizacao_exigida_a: v }))} />
            <p className="text-xs text-slate-400">
              Suporte de solo próximo à parede → Parede. Suporte de solo afastado da parede → Haste.
            </p>
          </div>
        )}

        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input type="checkbox" checked={form.tem_slot_a} onChange={e => setForm(f => ({ ...f, tem_slot_a: e.target.checked }))} className="accent-red-500" />
            Slot A
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input type="checkbox" checked={form.tem_slot_b} onChange={e => setForm(f => ({ ...f, tem_slot_b: e.target.checked }))} className="accent-red-500" />
            Slot B
          </label>
        </div>

        {form.tem_slot_b && (
          <div className="space-y-2">
            <p className="text-xs text-sci-muted font-medium">Identificação dos extintores (opcional)</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <div>
                  <label className="text-xs text-slate-400">Extintor A</label>
                  <input type="text" value={form.descricao_slot_a}
                    onChange={e => setForm(f => ({ ...f, descricao_slot_a: e.target.value }))}
                    placeholder="ex: parede" className="w-full mt-1" />
                </div>
                <div>
                  <label className="text-xs text-slate-400">Tipo de Sinalização</label>
                  <ToggleSinalizacao valor={form.sinalizacao_exigida_a} onChange={v => setForm(f => ({ ...f, sinalizacao_exigida_a: v }))} />
                </div>
              </div>
              <div className="space-y-2">
                <div>
                  <label className="text-xs text-slate-400">Extintor B</label>
                  <input type="text" value={form.descricao_slot_b}
                    onChange={e => setForm(f => ({ ...f, descricao_slot_b: e.target.value }))}
                    placeholder="ex: chão" className="w-full mt-1" />
                </div>
                <div>
                  <label className="text-xs text-slate-400">Tipo de Sinalização</label>
                  <ToggleSinalizacao valor={form.sinalizacao_exigida_b} onChange={v => setForm(f => ({ ...f, sinalizacao_exigida_b: v }))} />
                </div>
              </div>
            </div>
            <p className="text-xs text-slate-400">
              Suporte de solo próximo à parede → Parede. Suporte de solo afastado da parede → Haste.
            </p>
          </div>
        )}
        <button onClick={salvar} disabled={salvando} className="btn-primary w-full">
          {salvando ? 'Salvando...' : editandoId ? 'Salvar Alterações' : 'Adicionar Local'}
        </button>
      </div>
      )}

      <div className="space-y-2">
        <p className="text-xs text-sci-muted font-medium uppercase tracking-wider">{locais.length} locais cadastrados</p>
        {locais.map(l => (
          <div key={l.id} className={`card flex items-stretch justify-between gap-3 p-0 overflow-hidden ${editandoId === l.id ? 'ring-2 ring-sci-red' : ''}`}>
            {/* Número — altura total */}
            <div className="bg-sci-red flex items-center justify-center min-w-[4rem] px-2 shrink-0 self-stretch">
              <span className="font-bold text-white text-sm">{String(l.numero).padStart(2, '0')}</span>
            </div>
            {/* Conteúdo */}
            <div className="flex-1 py-2.5 min-w-0">
              <p className="text-xs font-medium text-slate-700 leading-tight">
                {l.edificacao}
                {(l.planta_tipo_exigido || l.planta_cap_ext_exigida) && (
                  <span className="text-slate-400 font-normal ml-1">
                    · {[l.planta_tipo_exigido, l.planta_cap_ext_exigida].filter(Boolean).join(' ')}
                  </span>
                )}
              </p>
              {l.descricao && (
                <p className="text-xs text-slate-400 leading-tight mt-0.5">{l.descricao}</p>
              )}
            </div>
            {/* Ações */}
            <div className="flex items-center pr-3 shrink-0">
              <button onClick={() => editarLocal(l)} className="text-xs text-slate-400 hover:text-sci-red underline">editar</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function AdminTipos() {
  const showToast = useToast()
  const [tipos, setTipos] = useState([])
  const [arquivados, setArquivados] = useState([])
  const [tipo, setTipo] = useState('')
  const [kg, setKg] = useState('')
  const [unidade, setUnidade] = useState('kg')
  const [verArquivados, setVerArquivados] = useState(false)

  useEffect(() => { carregar() }, [])
  async function carregar() {
    const [{ data: ativos }, { data: inativos }] = await Promise.all([
      supabase.from('tipos_extintor').select('*').eq('ativo', true).order('tipo'),
      supabase.from('tipos_extintor').select('*').eq('ativo', false).order('tipo')
    ])
    setTipos(ativos || [])
    setArquivados(inativos || [])
  }
  async function salvar() {
    if (!tipo || !kg) return
    try {
      const resultado = await salvarRegistroAdmin({ tabela: 'tipos_extintor', payload: { tipo: tipo.trim(), kg: parseFloat(kg), unidade } })
      setTipo(''); setKg(''); setUnidade('kg')
      avisarResultado(showToast, resultado, 'Tipo adicionado.')
      carregar()
    } catch (e) { alert('Erro: ' + e.message) }
  }
  async function arquivar(id) {
    try {
      const resultado = await atualizarCampoAdmin({ tabela: 'tipos_extintor', id, campos: { ativo: false } })
      avisarResultado(showToast, resultado, 'Tipo arquivado.')
      carregar()
    } catch (e) { alert('Erro: ' + e.message) }
  }
  async function restaurar(id) {
    try {
      const resultado = await atualizarCampoAdmin({ tabela: 'tipos_extintor', id, campos: { ativo: true } })
      avisarResultado(showToast, resultado, 'Tipo restaurado.')
      carregar()
    } catch (e) { alert('Erro: ' + e.message) }
  }
  async function excluir(id) {
    if (!confirm('Excluir permanentemente? Esta ação não pode ser desfeita.')) return
    try {
      const resultado = await excluirRegistroAdmin({ tabela: 'tipos_extintor', id })
      avisarResultado(showToast, resultado, 'Tipo excluído.')
      carregar()
    } catch (e) { alert('Erro: ' + e.message) }
  }

  return (
    <div className="space-y-4">
      <div className="card space-y-3">
        <p className="text-sm font-bold text-sci-text">Novo Tipo</p>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <input type="text" list="dl-tipos-extintor" value={tipo} onChange={e => setTipo(e.target.value)} placeholder="ex: CO²" className="w-full" />
            <datalist id="dl-tipos-extintor">
              {[...new Set(tipos.map(t => t.tipo))].sort().map(t => <option key={t} value={t} />)}
            </datalist>
          </div>
          <input type="number" value={kg} onChange={e => setKg(e.target.value)} placeholder="Capacidade (ex: 6)" />
        </div>
        <div className="flex gap-2">
          {['kg', 'L'].map(u => (
            <button
              key={u}
              onClick={() => setUnidade(u)}
              className={`btn-option flex-1 text-sm ${unidade === u ? 'selected' : ''}`}
            >
              {u}
            </button>
          ))}
        </div>
        <button onClick={salvar} className="btn-primary w-full">Adicionar</button>
      </div>

      <div className="space-y-2">
        {tipos.map(t => (
          <div key={t.id} className="card flex items-center justify-between gap-2 py-2.5">
            <span className="text-sm text-slate-700">{t.tipo} — {t.kg}{t.unidade || 'kg'}</span>
            <div className="flex gap-3 shrink-0">
              <button onClick={() => arquivar(t.id)} className="text-xs text-slate-400 hover:text-amber-600 transition-colors">Arquivar</button>
              <button onClick={() => excluir(t.id)} className="text-xs text-slate-400 hover:text-red-600 transition-colors">Excluir</button>
            </div>
          </div>
        ))}
      </div>

      {arquivados.length > 0 && (
        <div>
          <button
            onClick={() => setVerArquivados(v => !v)}
            className="text-xs text-slate-400 underline"
          >
            {verArquivados ? 'Ocultar arquivados' : `Ver arquivados (${arquivados.length})`}
          </button>
          {verArquivados && (
            <div className="space-y-2 mt-2">
              {arquivados.map(t => (
                <div key={t.id} className="card flex items-center justify-between gap-2 py-2.5 opacity-50">
                  <span className="text-sm text-slate-500 line-through">{t.tipo} — {t.kg}{t.unidade || 'kg'}</span>
                  <div className="flex gap-3 shrink-0">
                    <button onClick={() => restaurar(t.id)} className="text-xs text-blue-500 hover:text-blue-700 transition-colors no-underline">Restaurar</button>
                    <button onClick={() => excluir(t.id)} className="text-xs text-slate-400 hover:text-red-600 transition-colors">Excluir</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function AdminFatores() {
  const [grupo, setGrupo] = useState('operacional')

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {[
          { valor: 'operacional', label: 'Não Operacionalidade' },
          { valor: 'sinalizacao', label: 'Sinalização' }
        ].map(g => (
          <button key={g.valor} onClick={() => setGrupo(g.valor)}
            className={`btn-option text-xs flex-1 ${grupo === g.valor ? 'selected' : ''}`}>
            {g.label}
          </button>
        ))}
      </div>
      {grupo === 'operacional'
        ? <ListaFatores tabela="fatores_nao_operacionalidade" placeholder="ex: Lacre violado ou ausente" />
        : <ListaFatores tabela="fatores_sinalizacao_nao_conforme" placeholder="ex: Placa ausente" />}
    </div>
  )
}

function ListaFatores({ tabela, placeholder }) {
  const showToast = useToast()
  const [fatores, setFatores] = useState([])
  const [arquivados, setArquivados] = useState([])
  const [descricao, setDescricao] = useState('')
  const [verArquivados, setVerArquivados] = useState(false)

  useEffect(() => { carregar() }, [tabela])
  async function carregar() {
    const [{ data: ativos }, { data: inativos }] = await Promise.all([
      supabase.from(tabela).select('*').eq('ativo', true).order('ordem'),
      supabase.from(tabela).select('*').eq('ativo', false).order('ordem')
    ])
    setFatores(ativos || [])
    setArquivados(inativos || [])
  }
  async function salvar() {
    if (!descricao.trim()) return
    try {
      const resultado = await salvarRegistroAdmin({ tabela, payload: { descricao: descricao.trim(), ordem: fatores.length + 1 } })
      setDescricao('')
      avisarResultado(showToast, resultado, 'Fator adicionado.')
      carregar()
    } catch (e) { alert('Erro: ' + e.message) }
  }
  async function arquivar(id) {
    try {
      const resultado = await atualizarCampoAdmin({ tabela, id, campos: { ativo: false } })
      avisarResultado(showToast, resultado, 'Fator arquivado.')
      carregar()
    } catch (e) { alert('Erro: ' + e.message) }
  }
  async function restaurar(id) {
    try {
      const resultado = await atualizarCampoAdmin({ tabela, id, campos: { ativo: true } })
      avisarResultado(showToast, resultado, 'Fator restaurado.')
      carregar()
    } catch (e) { alert('Erro: ' + e.message) }
  }
  async function excluir(id) {
    if (!confirm('Excluir permanentemente? Esta ação não pode ser desfeita.')) return
    try {
      const resultado = await excluirRegistroAdmin({ tabela, id })
      avisarResultado(showToast, resultado, 'Fator excluído.')
      carregar()
    } catch (e) { alert('Erro: ' + e.message) }
  }

  return (
    <div className="space-y-4">
      <div className="card space-y-3">
        <p className="text-sm font-bold text-sci-text">Novo Fator</p>
        <input type="text" value={descricao} onChange={e => setDescricao(e.target.value)}
          placeholder={placeholder}
          className="w-full" />
        <button onClick={salvar} className="btn-primary w-full">Adicionar</button>
      </div>

      <div className="space-y-2">
        {fatores.map(f => (
          <div key={f.id} className="card flex items-center justify-between gap-2 py-2.5">
            <span className="text-sm text-slate-700">{f.descricao}</span>
            <div className="flex gap-3 shrink-0">
              <button onClick={() => arquivar(f.id)} className="text-xs text-slate-400 hover:text-amber-600 transition-colors">Arquivar</button>
              <button onClick={() => excluir(f.id)} className="text-xs text-slate-400 hover:text-red-600 transition-colors">Excluir</button>
            </div>
          </div>
        ))}
      </div>

      {arquivados.length > 0 && (
        <div>
          <button
            onClick={() => setVerArquivados(v => !v)}
            className="text-xs text-slate-400 underline"
          >
            {verArquivados ? 'Ocultar arquivados' : `Ver arquivados (${arquivados.length})`}
          </button>
          {verArquivados && (
            <div className="space-y-2 mt-2">
              {arquivados.map(f => (
                <div key={f.id} className="card flex items-center justify-between gap-2 py-2.5 opacity-50">
                  <span className="text-sm text-slate-500 line-through">{f.descricao}</span>
                  <div className="flex gap-3 shrink-0">
                    <button onClick={() => restaurar(f.id)} className="text-xs text-blue-500 hover:text-blue-700 transition-colors">Restaurar</button>
                    <button onClick={() => excluir(f.id)} className="text-xs text-slate-400 hover:text-red-600 transition-colors">Excluir</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
