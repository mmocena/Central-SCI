import { useState, useEffect } from 'react'
import {
  fetchHidrantes, fetchCcis, fetchMangueiras, fetchDotacaoMangueira,
  fetchFatoresIntegridadeMangueira, fetchFatoresEsguicho, fetchFatoresChaveMangueira, fetchFatoresIntegridadeCaixaHidrante,
  fetchFatoresSinalizacao,
  registrarVistoriaMangueira, registrarVistoriaHidrante, registrarVistoriaCci
} from '../../lib/queries'
import FatorChips, { descricoesFatores } from '../../components/FatorChips'
import IconeCCI from '../../components/IconeCCI'
import { calcularConformidadeMangueira, textoObservacaoAutomaticaMangueira, validadeHidrostaticaVencida } from '../../lib/conformidadeMangueira'
import { useToast } from '../../components/Toast'

const STORAGE_KEY = 'sci_responsavel'
const EQUIPES = ['ALFA', 'BRAVO', 'CHARLIE', 'DELTA']
const ESTADO_MANGUEIRA_VAZIO = { integridadeOk: null, fatoresSelecionados: [], textoOutro: '' }

function labelTipoMangueira(t) {
  return t ? `${t.tipo} — ${t.diametro} — ${t.comprimento}m` : '—'
}

// Vistoria de mangueiras da Camada 2 — sem login de admin, mesmo modelo do
// /inspecao dos extintores: acesso livre, só pede nome via localStorage.
// Fica fora do menu principal por enquanto (ver memória
// project-central-sci-mangueiras).
export default function Vistoria() {
  const [nome, setNome] = useState(() => localStorage.getItem(STORAGE_KEY) || '')
  const [nomeSalvo, setNomeSalvo] = useState(() => !!localStorage.getItem(STORAGE_KEY))
  const [aba, setAba] = useState('hidrantes')

  function salvarNome() {
    if (!nome.trim()) return
    localStorage.setItem(STORAGE_KEY, nome.trim())
    setNomeSalvo(true)
  }

  return (
    <div className="p-4 space-y-4">
      <div>
        <p className="text-sm font-bold text-sci-text">Vistoria — Hidrantes/Mangueiras</p>
        <p className="text-xs text-slate-400">Caixas de hidrante, CCIs e Depósito</p>
      </div>

      {!nomeSalvo ? (
        <div className="card space-y-2">
          <p className="text-xs text-sci-muted">Informe seu nome pra registrar vistorias</p>
          <div className="flex gap-2">
            <input type="text" value={nome} onChange={e => setNome(e.target.value)} placeholder="Seu nome" className="flex-1" />
            <button onClick={salvarNome} className="btn-primary px-4">Salvar</button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>Responsável: <strong className="text-slate-600">{nome}</strong></span>
          <button onClick={() => { localStorage.removeItem(STORAGE_KEY); setNomeSalvo(false); setNome('') }} className="underline">trocar</button>
        </div>
      )}

      <div className="flex gap-2">
        {['hidrantes', 'ccis', 'deposito'].map(a => (
          <button key={a} onClick={() => setAba(a)} className={`btn-option text-xs flex-1 ${aba === a ? 'selected' : ''}`}>
            {a === 'hidrantes' ? 'Hidrantes' : a === 'ccis' ? 'CCIs' : 'Depósito'}
          </button>
        ))}
      </div>

      {aba === 'hidrantes' && <AbaHidrantes responsavel={nome} bloqueado={!nomeSalvo} />}
      {aba === 'ccis' && <AbaCcis responsavel={nome} bloqueado={!nomeSalvo} />}
      {aba === 'deposito' && <AbaDeposito responsavel={nome} bloqueado={!nomeSalvo} />}
    </div>
  )
}

// Linha de comparação "presente × exigido" por tipo de mangueira — só
// exibição, não editável aqui (mover mangueira de lugar é cadastro).
function ComparacaoDotacao({ dotacao, mangueiras }) {
  if (dotacao.length === 0) return null
  const contagem = {}
  mangueiras.forEach(m => { contagem[m.tipo_mangueira_id] = (contagem[m.tipo_mangueira_id] || 0) + 1 })
  return (
    <div className="space-y-1">
      <p className="text-xs text-sci-muted font-medium">Dotação de mangueiras</p>
      {dotacao.map(d => {
        const presente = contagem[d.tipo_mangueira_id] || 0
        const ok = presente >= d.quantidade_exigida
        return (
          <div key={d.id} className="flex items-center justify-between text-sm">
            <span className="text-slate-600">{labelTipoMangueira(d.tipos_mangueira)}</span>
            <span className={ok ? 'text-green-600 font-medium' : 'text-sci-red font-semibold'}>{presente} / {d.quantidade_exigida}</span>
          </div>
        )
      })}
    </div>
  )
}

function CardMangueira({ mangueira, fatoresIntegridade, estado, onChange }) {
  const vencida = validadeHidrostaticaVencida(mangueira.validade_teste_hidrostatico)
  return (
    <div className="rounded-xl border border-slate-200 p-3 space-y-2 bg-white">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-sci-text">{mangueira.identificacao}</p>
          <p className="text-xs text-slate-500">{labelTipoMangueira(mangueira.tipos_mangueira)}</p>
        </div>
        {vencida && <span className="text-xs font-semibold text-sci-red shrink-0">Teste vencido</span>}
      </div>
      <div className="flex gap-2">
        {['Íntegra', 'Não Íntegra'].map(v => (
          <button key={v}
            onClick={() => onChange({ ...estado, integridadeOk: v === 'Íntegra' })}
            className={`btn-option flex-1 text-sm ${estado.integridadeOk === (v === 'Íntegra') ? 'selected' : ''}`}>
            {v}
          </button>
        ))}
      </div>
      {estado.integridadeOk === false && (
        <FatorChips
          label="Fator(es) de integridade:"
          catalogo={fatoresIntegridade}
          selecionados={estado.fatoresSelecionados}
          textoOutro={estado.textoOutro}
          onToggle={id => onChange({
            ...estado,
            fatoresSelecionados: estado.fatoresSelecionados.includes(id)
              ? estado.fatoresSelecionados.filter(x => x !== id)
              : [...estado.fatoresSelecionados, id]
          })}
          onTextoOutro={texto => onChange({ ...estado, textoOutro: texto })}
        />
      )}
    </div>
  )
}

async function registrarMangueirasAlteradas({ mangueiras, estadoMangueiras, fatoresIntegridade, responsavel, equipe }) {
  let algumEnfileirado = false
  for (const m of mangueiras) {
    const est = estadoMangueiras[m.id]
    if (!est || est.integridadeOk === null) continue
    const fatoresDesc = descricoesFatores(fatoresIntegridade, est.fatoresSelecionados, est.textoOutro)
    const conformidade = calcularConformidadeMangueira({ integridadeOk: est.integridadeOk, validadeTesteHidrostatico: m.validade_teste_hidrostatico })
    const observacoes = textoObservacaoAutomaticaMangueira({ integridadeOk: est.integridadeOk, fatoresIntegridade: fatoresDesc, validadeTesteHidrostatico: m.validade_teste_hidrostatico })
    const r = await registrarVistoriaMangueira({ mangueiraId: m.id, responsavel, equipe, integridadeOk: est.integridadeOk, fatoresIntegridade: fatoresDesc, conformidade, observacoes })
    if (r.queued) algumEnfileirado = true
  }
  return algumEnfileirado
}

function mangueirasEstaoOk({ mangueiras, estadoMangueiras, dotacao }) {
  const semNaoIntegra = mangueiras.every(m => (estadoMangueiras[m.id]?.integridadeOk) !== false)
  const contagem = {}
  mangueiras.forEach(m => { contagem[m.tipo_mangueira_id] = (contagem[m.tipo_mangueira_id] || 0) + 1 })
  const dotacaoAtendida = dotacao.every(d => (contagem[d.tipo_mangueira_id] || 0) >= d.quantidade_exigida)
  return semNaoIntegra && dotacaoAtendida
}

function AbaHidrantes({ responsavel, bloqueado }) {
  const showToast = useToast()
  const [hidrantes, setHidrantes] = useState([])
  const [selecionado, setSelecionado] = useState(null)
  const [mangueiras, setMangueiras] = useState([])
  const [dotacao, setDotacao] = useState([])
  const [fatoresIntegridade, setFatoresIntegridade] = useState([])
  const [fatoresEsguicho, setFatoresEsguicho] = useState([])
  const [fatoresChave, setFatoresChave] = useState([])
  const [fatoresCaixa, setFatoresCaixa] = useState([])
  const [fatoresSinalizacao, setFatoresSinalizacao] = useState([])
  const [estadoMangueiras, setEstadoMangueiras] = useState({})
  const [equipe, setEquipe] = useState('')
  const [esguicho, setEsguicho] = useState({ ok: null, fatores: [], outro: '' })
  const [chave, setChave] = useState({ ok: null, fatores: [], outro: '' })
  const [caixa, setCaixa] = useState({ ok: null, fatores: [], outro: '' })
  const [sinalizacao, setSinalizacao] = useState({ ok: null, fatores: [], outro: '' })
  const [observacoes, setObservacoes] = useState('')
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    fetchHidrantes().then(setHidrantes)
    fetchFatoresIntegridadeMangueira().then(setFatoresIntegridade)
    fetchFatoresEsguicho().then(setFatoresEsguicho)
    fetchFatoresChaveMangueira().then(setFatoresChave)
    fetchFatoresIntegridadeCaixaHidrante().then(setFatoresCaixa)
    fetchFatoresSinalizacao().then(setFatoresSinalizacao)
  }, [])

  async function abrir(h) {
    setSelecionado(h)
    const [todasMangueiras, dotacaoAtual] = await Promise.all([
      fetchMangueiras(),
      fetchDotacaoMangueira('HIDRANTE', h.id)
    ])
    const mangueirasDoHidrante = todasMangueiras.filter(m => m.hidrante_id === h.id)
    setMangueiras(mangueirasDoHidrante)
    setDotacao(dotacaoAtual)
    setEstadoMangueiras(Object.fromEntries(mangueirasDoHidrante.map(m => [m.id, { ...ESTADO_MANGUEIRA_VAZIO }])))
    setEquipe('')
    setEsguicho({ ok: null, fatores: [], outro: '' })
    setChave({ ok: null, fatores: [], outro: '' })
    setCaixa({ ok: null, fatores: [], outro: '' })
    setSinalizacao({ ok: null, fatores: [], outro: '' })
    setObservacoes('')
  }

  function fechar() { setSelecionado(null) }

  function toggleGrupo(grupo, setGrupo, catalogoOutros, id) {
    setGrupo(g => ({
      ...g,
      fatores: g.fatores.includes(id) ? g.fatores.filter(x => x !== id) : [...g.fatores, id]
    }))
  }

  async function registrar() {
    if (!responsavel) return alert('Informe seu nome antes de registrar.')
    if (!equipe) return alert('Selecione a equipe.')
    if (esguicho.ok === null || chave.ok === null || caixa.ok === null || sinalizacao.ok === null) {
      return alert('Informe esguicho, chave, caixa e sinalização.')
    }
    setEnviando(true)
    try {
      let algumEnfileirado = await registrarMangueirasAlteradas({ mangueiras, estadoMangueiras, fatoresIntegridade, responsavel, equipe })

      const mangueirasOk = mangueirasEstaoOk({ mangueiras, estadoMangueiras, dotacao })
      const motivos = []
      if (esguicho.ok === false) motivos.push('Esguicho')
      if (chave.ok === false) motivos.push('Chave de mangueira')
      if (caixa.ok === false) motivos.push('Caixa')
      if (sinalizacao.ok === false) motivos.push('Sinalização')
      if (!mangueirasOk) motivos.push('Mangueiras')
      const conformidade = motivos.length ? 'nao_conforme' : 'conforme'

      const r = await registrarVistoriaHidrante({
        hidranteId: selecionado.id, responsavel, equipe,
        esguichoOk: esguicho.ok, fatoresEsguicho: descricoesFatores(fatoresEsguicho, esguicho.fatores, esguicho.outro),
        chaveOk: chave.ok, fatoresChave: descricoesFatores(fatoresChave, chave.fatores, chave.outro),
        caixaOk: caixa.ok, fatoresCaixa: descricoesFatores(fatoresCaixa, caixa.fatores, caixa.outro),
        sinalizacaoOk: sinalizacao.ok, fatoresSinalizacao: descricoesFatores(fatoresSinalizacao, sinalizacao.fatores, sinalizacao.outro),
        conformidade, motivoNaoConformidade: motivos.length ? motivos.join(', ') : null,
        observacoes: observacoes.trim() || null
      })
      if (r.queued) algumEnfileirado = true

      showToast(algumEnfileirado ? 'Sem conexão — será enviado automaticamente ao reconectar.' : 'Vistoria registrada com sucesso.', algumEnfileirado ? 'aviso' : 'sucesso')
      fechar()
    } catch (e) {
      alert('Erro: ' + e.message)
    } finally {
      setEnviando(false)
    }
  }

  if (selecionado) {
    return (
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-sci-text">Hidrante {String(selecionado.numero).padStart(2, '0')} — {selecionado.edificacao}</p>
          <button onClick={fechar} className="text-xs text-slate-400 underline">Cancelar</button>
        </div>

        <ComparacaoDotacao dotacao={dotacao} mangueiras={mangueiras} />

        <div className="space-y-2">
          <p className="text-xs text-sci-muted font-medium">Mangueiras presentes</p>
          {mangueiras.length === 0 ? (
            <p className="text-xs text-slate-400 italic">Nenhuma mangueira cadastrada neste hidrante.</p>
          ) : mangueiras.map(m => (
            <CardMangueira key={m.id} mangueira={m} fatoresIntegridade={fatoresIntegridade}
              estado={estadoMangueiras[m.id] || ESTADO_MANGUEIRA_VAZIO}
              onChange={novoEstado => setEstadoMangueiras(s => ({ ...s, [m.id]: novoEstado }))} />
          ))}
        </div>

        {[
          { titulo: 'Esguicho', estado: esguicho, setEstado: setEsguicho, catalogo: fatoresEsguicho },
          { titulo: 'Chave de mangueira', estado: chave, setEstado: setChave, catalogo: fatoresChave },
          { titulo: 'Caixa de hidrante', estado: caixa, setEstado: setCaixa, catalogo: fatoresCaixa },
          { titulo: 'Sinalização', estado: sinalizacao, setEstado: setSinalizacao, catalogo: fatoresSinalizacao }
        ].map(({ titulo, estado, setEstado, catalogo }) => (
          <div key={titulo} className="space-y-2">
            <p className="text-sm text-slate-700">{titulo} está conforme?</p>
            <div className="flex gap-2">
              {['Sim', 'Não'].map(v => (
                <button key={v} onClick={() => setEstado(e => ({ ...e, ok: v === 'Sim' }))}
                  className={`btn-option flex-1 ${estado.ok === (v === 'Sim') ? 'selected' : ''}`}>
                  {v}
                </button>
              ))}
            </div>
            {estado.ok === false && catalogo.length > 0 && (
              <FatorChips label={`Fator(es) de ${titulo.toLowerCase()}:`} catalogo={catalogo}
                selecionados={estado.fatores} textoOutro={estado.outro}
                onToggle={id => toggleGrupo(titulo, setEstado, catalogo, id)}
                onTextoOutro={texto => setEstado(e => ({ ...e, outro: texto }))} />
            )}
          </div>
        ))}

        <div className="space-y-2">
          <p className="text-sm text-slate-700">Observações:</p>
          <textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={2} className="resize-none"
            placeholder="Escreva mais detalhes aqui, se necessário." />
        </div>

        <div className="space-y-2">
          <p className="text-sm text-slate-700">Equipe:</p>
          <div className="grid grid-cols-4 gap-2">
            {EQUIPES.map(eq => (
              <button key={eq} onClick={() => setEquipe(eq)} className={`btn-option text-sm font-semibold ${equipe === eq ? 'selected' : ''}`}>{eq}</button>
            ))}
          </div>
        </div>

        <button onClick={registrar} disabled={bloqueado || enviando} className="btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed">
          {enviando ? 'Registrando...' : 'Registrar Vistoria'}
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {hidrantes.map(h => (
        <button key={h.id} onClick={() => abrir(h)} className="card w-full flex items-stretch justify-between gap-3 p-0 overflow-hidden text-left">
          <div className="bg-sci-red flex items-center justify-center min-w-[4rem] px-2 shrink-0">
            <span className="font-bold text-white text-sm">{String(h.numero).padStart(2, '0')}</span>
          </div>
          <div className="flex-1 py-2.5 min-w-0">
            <p className="text-xs font-medium text-slate-700">{h.edificacao}</p>
            {h.descricao && <p className="text-xs text-slate-400">{h.descricao}</p>}
          </div>
        </button>
      ))}
    </div>
  )
}

function AbaCcis({ responsavel, bloqueado }) {
  const showToast = useToast()
  const [ccis, setCcis] = useState([])
  const [selecionado, setSelecionado] = useState(null)
  const [mangueiras, setMangueiras] = useState([])
  const [dotacao, setDotacao] = useState([])
  const [fatoresIntegridade, setFatoresIntegridade] = useState([])
  const [estadoMangueiras, setEstadoMangueiras] = useState({})
  const [equipe, setEquipe] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    fetchCcis().then(setCcis)
    fetchFatoresIntegridadeMangueira().then(setFatoresIntegridade)
  }, [])

  async function abrir(c) {
    setSelecionado(c)
    const [todasMangueiras, dotacaoAtual] = await Promise.all([
      fetchMangueiras(),
      fetchDotacaoMangueira('CCI', c.id)
    ])
    const mangueirasDoCci = todasMangueiras.filter(m => m.cci_id === c.id)
    setMangueiras(mangueirasDoCci)
    setDotacao(dotacaoAtual)
    setEstadoMangueiras(Object.fromEntries(mangueirasDoCci.map(m => [m.id, { ...ESTADO_MANGUEIRA_VAZIO }])))
    setEquipe('')
    setObservacoes('')
  }

  function fechar() { setSelecionado(null) }

  async function registrar() {
    if (!responsavel) return alert('Informe seu nome antes de registrar.')
    if (!equipe) return alert('Selecione a equipe.')
    setEnviando(true)
    try {
      let algumEnfileirado = await registrarMangueirasAlteradas({ mangueiras, estadoMangueiras, fatoresIntegridade, responsavel, equipe })

      const conformidade = mangueirasEstaoOk({ mangueiras, estadoMangueiras, dotacao }) ? 'conforme' : 'nao_conforme'
      const r = await registrarVistoriaCci({ cciId: selecionado.id, responsavel, equipe, conformidade, observacoes: observacoes.trim() || null })
      if (r.queued) algumEnfileirado = true

      showToast(algumEnfileirado ? 'Sem conexão — será enviado automaticamente ao reconectar.' : 'Vistoria registrada com sucesso.', algumEnfileirado ? 'aviso' : 'sucesso')
      fechar()
    } catch (e) {
      alert('Erro: ' + e.message)
    } finally {
      setEnviando(false)
    }
  }

  if (selecionado) {
    return (
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-sci-text">CCI {String(selecionado.numero).padStart(2, '0')}{selecionado.placa ? ` — ${selecionado.placa}` : ''}</p>
          <button onClick={fechar} className="text-xs text-slate-400 underline">Cancelar</button>
        </div>

        <ComparacaoDotacao dotacao={dotacao} mangueiras={mangueiras} />

        <div className="space-y-2">
          <p className="text-xs text-sci-muted font-medium">Mangueiras presentes</p>
          {mangueiras.length === 0 ? (
            <p className="text-xs text-slate-400 italic">Nenhuma mangueira cadastrada neste CCI.</p>
          ) : mangueiras.map(m => (
            <CardMangueira key={m.id} mangueira={m} fatoresIntegridade={fatoresIntegridade}
              estado={estadoMangueiras[m.id] || ESTADO_MANGUEIRA_VAZIO}
              onChange={novoEstado => setEstadoMangueiras(s => ({ ...s, [m.id]: novoEstado }))} />
          ))}
        </div>

        <div className="space-y-2">
          <p className="text-sm text-slate-700">Observações:</p>
          <textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={2} className="resize-none"
            placeholder="Escreva mais detalhes aqui, se necessário." />
        </div>

        <div className="space-y-2">
          <p className="text-sm text-slate-700">Equipe:</p>
          <div className="grid grid-cols-4 gap-2">
            {EQUIPES.map(eq => (
              <button key={eq} onClick={() => setEquipe(eq)} className={`btn-option text-sm font-semibold ${equipe === eq ? 'selected' : ''}`}>{eq}</button>
            ))}
          </div>
        </div>

        <button onClick={registrar} disabled={bloqueado || enviando} className="btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed">
          {enviando ? 'Registrando...' : 'Registrar Vistoria'}
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {ccis.map(c => (
        <button key={c.id} onClick={() => abrir(c)} className="card w-full flex items-center gap-3 p-2 text-left">
          <div className="w-36 shrink-0">
            <IconeCCI numero={c.numero} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-slate-700">{c.modelo || '—'}</p>
            {c.placa && <p className="text-xs text-slate-400">{c.placa}</p>}
          </div>
        </button>
      ))}
    </div>
  )
}

function AbaDeposito({ responsavel, bloqueado }) {
  const showToast = useToast()
  const [mangueiras, setMangueiras] = useState([])
  const [fatoresIntegridade, setFatoresIntegridade] = useState([])
  const [estadoMangueiras, setEstadoMangueiras] = useState({})
  const [equipe, setEquipe] = useState('')
  const [enviandoId, setEnviandoId] = useState(null)

  useEffect(() => {
    carregar()
    fetchFatoresIntegridadeMangueira().then(setFatoresIntegridade)
  }, [])

  async function carregar() {
    const todas = await fetchMangueiras()
    const doDeposito = todas.filter(m => m.localizacao_tipo === 'DEPOSITO')
    setMangueiras(doDeposito)
    setEstadoMangueiras(Object.fromEntries(doDeposito.map(m => [m.id, { ...ESTADO_MANGUEIRA_VAZIO }])))
  }

  async function registrar(m) {
    if (!responsavel) return alert('Informe seu nome antes de registrar.')
    if (!equipe) return alert('Selecione a equipe.')
    const est = estadoMangueiras[m.id]
    if (!est || est.integridadeOk === null) return alert('Marque Íntegra ou Não Íntegra.')
    setEnviandoId(m.id)
    try {
      const fatoresDesc = descricoesFatores(fatoresIntegridade, est.fatoresSelecionados, est.textoOutro)
      const conformidade = calcularConformidadeMangueira({ integridadeOk: est.integridadeOk, validadeTesteHidrostatico: m.validade_teste_hidrostatico })
      const observacoes = textoObservacaoAutomaticaMangueira({ integridadeOk: est.integridadeOk, fatoresIntegridade: fatoresDesc, validadeTesteHidrostatico: m.validade_teste_hidrostatico })
      const r = await registrarVistoriaMangueira({ mangueiraId: m.id, responsavel, equipe, integridadeOk: est.integridadeOk, fatoresIntegridade: fatoresDesc, conformidade, observacoes })
      showToast(r.queued ? 'Sem conexão — será enviado automaticamente ao reconectar.' : 'Vistoria registrada com sucesso.', r.queued ? 'aviso' : 'sucesso')
      await carregar()
    } catch (e) {
      alert('Erro: ' + e.message)
    } finally {
      setEnviandoId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-sm text-slate-700">Equipe:</p>
        <div className="grid grid-cols-4 gap-2">
          {EQUIPES.map(eq => (
            <button key={eq} onClick={() => setEquipe(eq)} className={`btn-option text-sm font-semibold ${equipe === eq ? 'selected' : ''}`}>{eq}</button>
          ))}
        </div>
      </div>

      {mangueiras.length === 0 ? (
        <p className="text-xs text-slate-400 italic">Nenhuma mangueira no depósito.</p>
      ) : mangueiras.map(m => (
        <div key={m.id} className="space-y-2">
          <CardMangueira mangueira={m} fatoresIntegridade={fatoresIntegridade}
            estado={estadoMangueiras[m.id] || ESTADO_MANGUEIRA_VAZIO}
            onChange={novoEstado => setEstadoMangueiras(s => ({ ...s, [m.id]: novoEstado }))} />
          <button onClick={() => registrar(m)} disabled={bloqueado || enviandoId === m.id}
            className="btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed">
            {enviandoId === m.id ? 'Registrando...' : `Registrar vistoria de ${m.identificacao}`}
          </button>
        </div>
      ))}
    </div>
  )
}
