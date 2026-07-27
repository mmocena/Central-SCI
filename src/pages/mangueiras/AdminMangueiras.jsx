import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import {
  salvarRegistroAdmin, atualizarCampoAdmin, excluirRegistroAdmin,
  fetchTiposMangueira, fetchHidrantes, fetchCcis, fetchDotacaoMangueira, salvarDotacaoMangueira
} from '../../lib/queries'
import { useToast, avisarResultado } from '../../components/Toast'
import TelaLoginAdmin, { SESSION_KEY } from '../../components/TelaLoginAdmin'

// Camada 1 do setor Hidrantes/Mangueiras — só cadastro base (sem vistoria,
// sem exigência/"Planta", sem histórico de movimentação — ver memória
// project-central-sci-mangueiras). Rota /mangueiras fica fora do menu
// principal por enquanto, de propósito.
export default function AdminMangueiras() {
  const [autenticado, setAutenticado] = useState(() => sessionStorage.getItem(SESSION_KEY) === '1')
  const [aba, setAba] = useState('hidrantes')

  if (!autenticado) return <TelaLoginAdmin />

  return (
    <div className="p-4 space-y-4">
      <div>
        <p className="text-sm font-bold text-sci-text">Setor Hidrantes/Mangueiras</p>
        <p className="text-xs text-slate-400">Cadastro de hidrantes, CCIs e mangueiras</p>
      </div>
      <div className="flex gap-2 flex-wrap">
        {['hidrantes', 'ccis', 'mangueiras', 'tipos'].map(a => (
          <button
            key={a}
            onClick={() => setAba(a)}
            className={`btn-option text-xs ${aba === a ? 'selected' : ''}`}
          >
            {a === 'hidrantes' ? 'Hidrantes' : a === 'ccis' ? 'CCIs' : a === 'mangueiras' ? 'Mangueiras' : 'Tipos de Mangueira'}
          </button>
        ))}
      </div>

      {aba === 'hidrantes' && <AdminHidrantes />}
      {aba === 'ccis' && <AdminCcis />}
      {aba === 'mangueiras' && <AdminMangueirasTab />}
      {aba === 'tipos' && <AdminTiposMangueira />}
    </div>
  )
}

function labelTipoMangueira(t) {
  return `${t.tipo} — ${t.diametro} — ${t.comprimento}m`
}

// Editor de dotação exigida (tipo -> quantidade), usado tanto por
// Hidrantes quanto por CCIs — só aparece em modo editar, já que precisa de
// um id real pra salvar via salvar_dotacao_mangueira.
function DotacaoEditor({ tiposMangueira, dotacao, setDotacao }) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-sci-muted font-medium">Dotação esperada de mangueiras</p>
      {tiposMangueira.length === 0 ? (
        <p className="text-xs text-slate-400 italic">Cadastre um tipo de mangueira primeiro.</p>
      ) : (
        <div className="space-y-1.5">
          {tiposMangueira.map(t => (
            <div key={t.id} className="flex items-center justify-between gap-2">
              <span className="text-sm text-slate-700">{labelTipoMangueira(t)}</span>
              <input type="number" min="0" value={dotacao[t.id] || ''}
                onChange={e => setDotacao(d => ({ ...d, [t.id]: e.target.value }))}
                placeholder="0" className="w-20 text-center" />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function AdminTiposMangueira() {
  const showToast = useToast()
  const [tipos, setTipos] = useState([])
  const [arquivados, setArquivados] = useState([])
  const [tipo, setTipo] = useState('')
  const [diametro, setDiametro] = useState('')
  const [comprimento, setComprimento] = useState('')
  const [verArquivados, setVerArquivados] = useState(false)

  useEffect(() => { carregar() }, [])
  async function carregar() {
    const [{ data: ativos }, { data: inativos }] = await Promise.all([
      supabase.from('tipos_mangueira').select('*').eq('ativo', true).order('diametro'),
      supabase.from('tipos_mangueira').select('*').eq('ativo', false).order('diametro')
    ])
    setTipos(ativos || [])
    setArquivados(inativos || [])
  }
  async function salvar() {
    if (!tipo.trim() || !diametro.trim() || !comprimento) return
    try {
      const resultado = await salvarRegistroAdmin({ tabela: 'tipos_mangueira', payload: { tipo: tipo.trim(), diametro: diametro.trim(), comprimento: parseFloat(comprimento) } })
      setTipo(''); setDiametro(''); setComprimento('')
      avisarResultado(showToast, resultado, 'Tipo adicionado.')
      carregar()
    } catch (e) { alert('Erro: ' + e.message) }
  }
  async function arquivar(id) {
    try {
      const resultado = await atualizarCampoAdmin({ tabela: 'tipos_mangueira', id, campos: { ativo: false } })
      avisarResultado(showToast, resultado, 'Tipo arquivado.')
      carregar()
    } catch (e) { alert('Erro: ' + e.message) }
  }
  async function restaurar(id) {
    try {
      const resultado = await atualizarCampoAdmin({ tabela: 'tipos_mangueira', id, campos: { ativo: true } })
      avisarResultado(showToast, resultado, 'Tipo restaurado.')
      carregar()
    } catch (e) { alert('Erro: ' + e.message) }
  }
  async function excluir(id) {
    if (!confirm('Excluir permanentemente? Esta ação não pode ser desfeita.')) return
    try {
      const resultado = await excluirRegistroAdmin({ tabela: 'tipos_mangueira', id })
      avisarResultado(showToast, resultado, 'Tipo excluído.')
      carregar()
    } catch (e) { alert('Erro: ' + e.message) }
  }

  return (
    <div className="space-y-4 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-4 lg:items-start">
      <div className="card space-y-3">
        <p className="text-sm font-bold text-sci-text">Novo Tipo de Mangueira</p>
        <div>
          <label className="text-xs text-sci-muted">Tipo</label>
          <input type="text" value={tipo} onChange={e => setTipo(e.target.value)} placeholder="ex: Tipo 1, Tipo 2 (NBR 12779)" className="w-full mt-1" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-sci-muted">Diâmetro</label>
            <input type="text" value={diametro} onChange={e => setDiametro(e.target.value)} placeholder='ex: 1 1/2"' className="w-full mt-1" />
          </div>
          <div>
            <label className="text-xs text-sci-muted">Comprimento (m)</label>
            <input type="number" value={comprimento} onChange={e => setComprimento(e.target.value)} placeholder="ex: 15" className="w-full mt-1" />
          </div>
        </div>
        <button onClick={salvar} className="btn-primary w-full">Adicionar</button>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          {tipos.map(t => (
            <div key={t.id} className="card flex items-center justify-between gap-2 py-2.5">
              <span className="text-sm text-slate-700">{labelTipoMangueira(t)}</span>
              <div className="flex gap-3 shrink-0">
                <button onClick={() => arquivar(t.id)} className="text-xs text-slate-400 hover:text-amber-600 transition-colors">Arquivar</button>
                <button onClick={() => excluir(t.id)} className="text-xs text-slate-400 hover:text-red-600 transition-colors">Excluir</button>
              </div>
            </div>
          ))}
        </div>

        {arquivados.length > 0 && (
          <div>
            <button onClick={() => setVerArquivados(v => !v)} className="text-xs text-slate-400 underline">
              {verArquivados ? 'Ocultar arquivados' : `Ver arquivados (${arquivados.length})`}
            </button>
            {verArquivados && (
              <div className="space-y-2 mt-2">
                {arquivados.map(t => (
                  <div key={t.id} className="card flex items-center justify-between gap-2 py-2.5 opacity-50">
                    <span className="text-sm text-slate-500 line-through">{labelTipoMangueira(t)}</span>
                    <div className="flex gap-3 shrink-0">
                      <button onClick={() => restaurar(t.id)} className="text-xs text-blue-500 hover:text-blue-700 transition-colors">Restaurar</button>
                      <button onClick={() => excluir(t.id)} className="text-xs text-slate-400 hover:text-red-600 transition-colors">Excluir</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

const HIDRANTE_VAZIO = { numero: '', edificacao: '', descricao: '' }

function AdminHidrantes() {
  const showToast = useToast()
  const [hidrantes, setHidrantes] = useState([])
  const [tiposMangueira, setTiposMangueira] = useState([])
  const [form, setForm] = useState(HIDRANTE_VAZIO)
  const [dotacao, setDotacao] = useState({}) // tipo_mangueira_id -> quantidade
  const [salvando, setSalvando] = useState(false)
  const [editandoId, setEditandoId] = useState(null)
  const [formAberto, setFormAberto] = useState(false)

  useEffect(() => { carregar(); fetchTiposMangueira().then(setTiposMangueira) }, [])
  async function carregar() {
    const { data } = await supabase.from('hidrantes').select('*').eq('ativo', true).order('numero')
    setHidrantes(data || [])
  }

  const edificacoesUnicas = [...new Set(hidrantes.map(h => h.edificacao).filter(Boolean))].sort()

  async function editar(h) {
    setFormAberto(true)
    setEditandoId(h.id)
    setForm({ numero: String(h.numero), edificacao: h.edificacao, descricao: h.descricao || '' })
    const dotacaoAtual = await fetchDotacaoMangueira('HIDRANTE', h.id)
    setDotacao(Object.fromEntries(dotacaoAtual.map(d => [d.tipo_mangueira_id, String(d.quantidade_exigida)])))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelarEdicao() {
    setEditandoId(null)
    setFormAberto(false)
    setForm(HIDRANTE_VAZIO)
    setDotacao({})
  }

  async function salvar() {
    if (!form.numero || !form.edificacao) return alert('Número e Edificação são obrigatórios.')
    setSalvando(true)
    const payload = {
      numero: parseInt(form.numero),
      edificacao: form.edificacao.trim(),
      descricao: form.descricao.trim() || null
    }
    try {
      const resultado = await salvarRegistroAdmin({ tabela: 'hidrantes', id: editandoId, payload })
      if (editandoId) {
        const itens = Object.entries(dotacao)
          .filter(([, qtd]) => parseInt(qtd) > 0)
          .map(([tipoMangueiraId, qtd]) => ({ tipoMangueiraId, quantidade: parseInt(qtd) }))
        await salvarDotacaoMangueira({ localTipo: 'HIDRANTE', localId: editandoId, itens })
      }
      avisarResultado(showToast, resultado, editandoId ? 'Hidrante atualizado com sucesso.' : 'Hidrante cadastrado com sucesso — abra "editar" pra configurar a dotação.')
      cancelarEdicao()
      await carregar()
    } catch (e) {
      alert('Erro: ' + e.message)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="space-y-4">
      {!formAberto && (
        <button onClick={() => setFormAberto(true)} className="btn-primary w-full">+ Novo Hidrante</button>
      )}

      {formAberto && (
        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-sci-text">{editandoId ? 'Editar Hidrante' : 'Novo Hidrante'}</p>
            <button onClick={cancelarEdicao} className="text-xs text-slate-400 underline">Cancelar</button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-slate-400">Número *</label>
              <input type="number" value={form.numero} onChange={e => setForm(f => ({ ...f, numero: e.target.value }))} className="w-full mt-1" />
            </div>
            <div>
              <label className="text-xs text-sci-muted">Edificação *</label>
              <input type="text" list="dl-edificacoes-hidrante" value={form.edificacao} onChange={e => setForm(f => ({ ...f, edificacao: e.target.value }))} className="w-full mt-1" />
              <datalist id="dl-edificacoes-hidrante">
                {edificacoesUnicas.map(e => <option key={e} value={e} />)}
              </datalist>
            </div>
          </div>
          <div>
            <label className="text-xs text-sci-muted">Descrição / Localização</label>
            <input type="text" value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
              placeholder="ex: Próximo à guarita" className="w-full mt-1" />
          </div>

          {editandoId ? (
            <DotacaoEditor tiposMangueira={tiposMangueira} dotacao={dotacao} setDotacao={setDotacao} />
          ) : (
            <p className="text-xs text-slate-400">A dotação de mangueiras é configurada depois de salvar, em "editar".</p>
          )}

          <button onClick={salvar} disabled={salvando} className="btn-primary w-full">
            {salvando ? 'Salvando...' : editandoId ? 'Salvar Alterações' : 'Adicionar Hidrante'}
          </button>
        </div>
      )}

      <div className="space-y-2">
        <p className="text-xs text-sci-muted font-medium uppercase tracking-wider">{hidrantes.length} hidrantes cadastrados</p>
        {hidrantes.map(h => (
          <div key={h.id} className={`card flex items-stretch justify-between gap-3 p-0 overflow-hidden ${editandoId === h.id ? 'ring-2 ring-sci-red' : ''}`}>
            <div className="bg-sci-red flex items-center justify-center min-w-[4rem] px-2 shrink-0 self-stretch">
              <span className="font-bold text-white text-sm">{String(h.numero).padStart(2, '0')}</span>
            </div>
            <div className="flex-1 py-2.5 min-w-0">
              <p className="text-xs font-medium text-slate-700 leading-tight">{h.edificacao}</p>
              {h.descricao && <p className="text-xs text-slate-400 leading-tight mt-0.5">{h.descricao}</p>}
            </div>
            <div className="flex items-center pr-3 shrink-0">
              <button onClick={() => editar(h)} className="text-xs text-slate-400 hover:text-sci-red underline">editar</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const CCI_VAZIO = { numero: '', placa: '', modelo: '' }

function AdminCcis() {
  const showToast = useToast()
  const [ccis, setCcis] = useState([])
  const [tiposMangueira, setTiposMangueira] = useState([])
  const [form, setForm] = useState(CCI_VAZIO)
  const [dotacao, setDotacao] = useState({}) // tipo_mangueira_id -> quantidade
  const [salvando, setSalvando] = useState(false)
  const [editandoId, setEditandoId] = useState(null)
  const [formAberto, setFormAberto] = useState(false)

  useEffect(() => { carregar(); fetchTiposMangueira().then(setTiposMangueira) }, [])
  async function carregar() {
    const { data } = await supabase.from('ccis').select('*').eq('ativo', true).order('numero')
    setCcis(data || [])
  }

  async function editar(c) {
    setFormAberto(true)
    setEditandoId(c.id)
    setForm({ numero: String(c.numero), placa: c.placa || '', modelo: c.modelo || '' })
    const dotacaoAtual = await fetchDotacaoMangueira('CCI', c.id)
    setDotacao(Object.fromEntries(dotacaoAtual.map(d => [d.tipo_mangueira_id, String(d.quantidade_exigida)])))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelarEdicao() {
    setEditandoId(null)
    setFormAberto(false)
    setForm(CCI_VAZIO)
    setDotacao({})
  }

  async function salvar() {
    if (!form.numero) return alert('Número é obrigatório.')
    setSalvando(true)
    const payload = {
      numero: parseInt(form.numero),
      placa: form.placa.trim() || null,
      modelo: form.modelo.trim() || null
    }
    try {
      const resultado = await salvarRegistroAdmin({ tabela: 'ccis', id: editandoId, payload })
      if (editandoId) {
        const itens = Object.entries(dotacao)
          .filter(([, qtd]) => parseInt(qtd) > 0)
          .map(([tipoMangueiraId, qtd]) => ({ tipoMangueiraId, quantidade: parseInt(qtd) }))
        await salvarDotacaoMangueira({ localTipo: 'CCI', localId: editandoId, itens })
      }
      avisarResultado(showToast, resultado, editandoId ? 'CCI atualizado com sucesso.' : 'CCI cadastrado com sucesso — abra "editar" pra configurar a dotação.')
      cancelarEdicao()
      await carregar()
    } catch (e) {
      alert('Erro: ' + e.message)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="space-y-4">
      {!formAberto && (
        <button onClick={() => setFormAberto(true)} className="btn-primary w-full">+ Novo CCI</button>
      )}

      {formAberto && (
        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-sci-text">{editandoId ? 'Editar CCI' : 'Novo CCI'}</p>
            <button onClick={cancelarEdicao} className="text-xs text-slate-400 underline">Cancelar</button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-slate-400">Número *</label>
              <input type="number" value={form.numero} onChange={e => setForm(f => ({ ...f, numero: e.target.value }))} className="w-full mt-1" />
            </div>
            <div>
              <label className="text-xs text-sci-muted">Placa</label>
              <input type="text" value={form.placa} onChange={e => setForm(f => ({ ...f, placa: e.target.value }))} className="w-full mt-1" />
            </div>
          </div>
          <div>
            <label className="text-xs text-sci-muted">Modelo</label>
            <input type="text" value={form.modelo} onChange={e => setForm(f => ({ ...f, modelo: e.target.value }))} className="w-full mt-1" />
          </div>

          {editandoId ? (
            <DotacaoEditor tiposMangueira={tiposMangueira} dotacao={dotacao} setDotacao={setDotacao} />
          ) : (
            <p className="text-xs text-slate-400">A dotação de mangueiras é configurada depois de salvar, em "editar".</p>
          )}

          <button onClick={salvar} disabled={salvando} className="btn-primary w-full">
            {salvando ? 'Salvando...' : editandoId ? 'Salvar Alterações' : 'Adicionar CCI'}
          </button>
        </div>
      )}

      <div className="space-y-2">
        <p className="text-xs text-sci-muted font-medium uppercase tracking-wider">{ccis.length} CCIs cadastrados</p>
        {ccis.map(c => (
          <div key={c.id} className={`card flex items-stretch justify-between gap-3 p-0 overflow-hidden ${editandoId === c.id ? 'ring-2 ring-sci-red' : ''}`}>
            <div className="bg-sci-red flex items-center justify-center min-w-[4rem] px-2 shrink-0 self-stretch">
              <span className="font-bold text-white text-sm">{String(c.numero).padStart(2, '0')}</span>
            </div>
            <div className="flex-1 py-2.5 min-w-0">
              <p className="text-xs font-medium text-slate-700 leading-tight">{c.modelo || '—'}</p>
              {c.placa && <p className="text-xs text-slate-400 leading-tight mt-0.5">{c.placa}</p>}
            </div>
            <div className="flex items-center pr-3 shrink-0">
              <button onClick={() => editar(c)} className="text-xs text-slate-400 hover:text-sci-red underline">editar</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const MANGUEIRA_VAZIA = { identificacao: '', tipo_mangueira_id: '', localizacao_tipo: '', hidrante_id: '', cci_id: '', validade_teste_hidrostatico: '' }

function AdminMangueirasTab() {
  const showToast = useToast()
  const [mangueiras, setMangueiras] = useState([])
  const [tiposMangueira, setTiposMangueira] = useState([])
  const [hidrantes, setHidrantes] = useState([])
  const [ccis, setCcis] = useState([])
  const [form, setForm] = useState(MANGUEIRA_VAZIA)
  const [salvando, setSalvando] = useState(false)
  const [editandoId, setEditandoId] = useState(null)
  const [formAberto, setFormAberto] = useState(false)

  useEffect(() => {
    carregar()
    fetchTiposMangueira().then(setTiposMangueira)
    fetchHidrantes().then(setHidrantes)
    fetchCcis().then(setCcis)
  }, [])
  async function carregar() {
    const { data } = await supabase
      .from('mangueiras')
      .select('*, tipos_mangueira(diametro, comprimento), hidrantes(numero, edificacao), ccis(numero, placa)')
      .eq('ativo', true)
      .order('identificacao')
    setMangueiras(data || [])
  }

  function editar(m) {
    setFormAberto(true)
    setEditandoId(m.id)
    setForm({
      identificacao: m.identificacao,
      tipo_mangueira_id: m.tipo_mangueira_id,
      localizacao_tipo: m.localizacao_tipo,
      hidrante_id: m.hidrante_id || '',
      cci_id: m.cci_id || '',
      validade_teste_hidrostatico: m.validade_teste_hidrostatico || ''
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelarEdicao() {
    setEditandoId(null)
    setFormAberto(false)
    setForm(MANGUEIRA_VAZIA)
  }

  async function salvar() {
    if (!form.identificacao.trim() || !form.tipo_mangueira_id || !form.localizacao_tipo) {
      return alert('Identificação, Tipo e Localização são obrigatórios.')
    }
    if (form.localizacao_tipo === 'HIDRANTE' && !form.hidrante_id) return alert('Selecione o hidrante.')
    if (form.localizacao_tipo === 'CCI' && !form.cci_id) return alert('Selecione o CCI.')

    setSalvando(true)
    const payload = {
      identificacao: form.identificacao.trim(),
      tipo_mangueira_id: form.tipo_mangueira_id,
      localizacao_tipo: form.localizacao_tipo,
      hidrante_id: form.localizacao_tipo === 'HIDRANTE' ? form.hidrante_id : null,
      cci_id: form.localizacao_tipo === 'CCI' ? form.cci_id : null,
      validade_teste_hidrostatico: form.validade_teste_hidrostatico || null
    }
    let resultado
    try {
      resultado = await salvarRegistroAdmin({ tabela: 'mangueiras', id: editandoId, payload })
    } catch (e) {
      setSalvando(false)
      return alert('Erro: ' + e.message)
    }
    setSalvando(false)
    avisarResultado(showToast, resultado, editandoId ? 'Mangueira atualizada com sucesso.' : 'Mangueira cadastrada com sucesso.')
    cancelarEdicao()
    await carregar()
  }

  function labelLocalizacao(m) {
    if (m.localizacao_tipo === 'HIDRANTE' && m.hidrantes) return `Hidrante ${String(m.hidrantes.numero).padStart(2, '0')} — ${m.hidrantes.edificacao}`
    if (m.localizacao_tipo === 'CCI' && m.ccis) return `CCI ${String(m.ccis.numero).padStart(2, '0')}${m.ccis.placa ? ` — ${m.ccis.placa}` : ''}`
    return 'Depósito'
  }

  return (
    <div className="space-y-4">
      {!formAberto && (
        <button onClick={() => setFormAberto(true)} className="btn-primary w-full">+ Nova Mangueira</button>
      )}

      {formAberto && (
        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-sci-text">{editandoId ? 'Editar Mangueira' : 'Nova Mangueira'}</p>
            <button onClick={cancelarEdicao} className="text-xs text-slate-400 underline">Cancelar</button>
          </div>

          <div>
            <label className="text-xs text-sci-muted">Identificação (tag/nº de série) *</label>
            <input type="text" value={form.identificacao} onChange={e => setForm(f => ({ ...f, identificacao: e.target.value }))} className="w-full mt-1" />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-sci-muted">Tipo *</label>
            {tiposMangueira.length === 0 ? (
              <p className="text-xs text-slate-400 italic">Cadastre um tipo de mangueira primeiro.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {tiposMangueira.map(t => (
                  <button key={t.id} type="button" onClick={() => setForm(f => ({ ...f, tipo_mangueira_id: t.id }))}
                    className={`btn-option text-xs ${form.tipo_mangueira_id === t.id ? 'selected' : ''}`}>
                    {labelTipoMangueira(t)}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-xs text-sci-muted">Localização atual *</label>
            <div className="flex gap-2">
              {['HIDRANTE', 'CCI', 'DEPOSITO'].map(v => (
                <button key={v} type="button"
                  onClick={() => setForm(f => ({ ...f, localizacao_tipo: v, hidrante_id: '', cci_id: '' }))}
                  className={`btn-option flex-1 text-xs ${form.localizacao_tipo === v ? 'selected' : ''}`}>
                  {v === 'HIDRANTE' ? 'Hidrante' : v === 'CCI' ? 'CCI' : 'Depósito'}
                </button>
              ))}
            </div>
          </div>

          {form.localizacao_tipo === 'HIDRANTE' && (
            <div className="flex flex-wrap gap-2">
              {hidrantes.map(h => (
                <button key={h.id} type="button" onClick={() => setForm(f => ({ ...f, hidrante_id: h.id }))}
                  className={`btn-option text-xs ${form.hidrante_id === h.id ? 'selected' : ''}`}>
                  {String(h.numero).padStart(2, '0')} — {h.edificacao}
                </button>
              ))}
            </div>
          )}

          {form.localizacao_tipo === 'CCI' && (
            <div className="flex flex-wrap gap-2">
              {ccis.map(c => (
                <button key={c.id} type="button" onClick={() => setForm(f => ({ ...f, cci_id: c.id }))}
                  className={`btn-option text-xs ${form.cci_id === c.id ? 'selected' : ''}`}>
                  {String(c.numero).padStart(2, '0')}{c.placa ? ` — ${c.placa}` : ''}
                </button>
              ))}
            </div>
          )}

          <div>
            <label className="text-xs text-sci-muted">Validade do teste hidrostático</label>
            <input type="date" value={form.validade_teste_hidrostatico} onChange={e => setForm(f => ({ ...f, validade_teste_hidrostatico: e.target.value }))} className="w-full mt-1" />
          </div>

          <button onClick={salvar} disabled={salvando} className="btn-primary w-full">
            {salvando ? 'Salvando...' : editandoId ? 'Salvar Alterações' : 'Adicionar Mangueira'}
          </button>
        </div>
      )}

      <div className="space-y-2">
        <p className="text-xs text-sci-muted font-medium uppercase tracking-wider">{mangueiras.length} mangueiras cadastradas</p>
        {mangueiras.map(m => (
          <div key={m.id} className={`card space-y-1 ${editandoId === m.id ? 'ring-2 ring-sci-red' : ''}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-slate-700">{m.identificacao}</span>
              <button onClick={() => editar(m)} className="text-xs text-slate-400 hover:text-sci-red underline shrink-0">editar</button>
            </div>
            <p className="text-xs text-slate-500">
              {m.tipos_mangueira ? labelTipoMangueira(m.tipos_mangueira) : '—'} · {labelLocalizacao(m)}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
