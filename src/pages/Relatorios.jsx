import { useEffect, useRef, useState } from 'react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import {
  fetchLocaisComEstado, fetchInicioPeriodoInspecao, fetchHistoricoInspecoes, fetchTiposExtintor, fetchOrdensPendentes, fetchEstoqueDeposito
} from '../lib/queries'
import { calcularConformidade, tipoDivergente, separarMotivos, fatoresOperacionaisDoMotivo } from '../lib/conformidade'
import { unidadeDoTipo } from '../lib/formato'
import { useToast } from '../components/Toast'

const SITUACAO_LABEL = { conforme: 'Conforme', nao_conforme: 'Não Conforme' }

function ultimoDiaDoMes(anoMes) {
  const [ano, mes] = anoMes.split('-').map(Number)
  return new Date(ano, mes, 0).getDate()
}

function diasAte(dateStr) {
  if (!dateStr) return null
  return (new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24)
}

function formatValidadeN2Curto(val) {
  if (!val) return ''
  const [y, m] = val.split('-')
  return `${m}/${y}`
}

function situacaoDoRegistroHistorico(item) {
  const p = item.payload || {}
  const local = item.locais
  if (p.conformidade) return p.conformidade
  return calcularConformidade({
    capExtAtual: p.cap_ext_atual,
    capExtExigida: local?.planta_cap_ext_exigida,
    capExtOk: local?.planta_cap_ext_exigida ? p.cap_ext_ok : undefined,
    operacional: p.operacional,
    sinalizacaoOk: p.sinalizacao_ok,
    validadeNivel2: p.validade_nivel2,
    validadeNivel3: p.validade_nivel3
  })
}

function formatDataHora(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function formatN2(val) {
  if (!val) return '—'
  const [y, m] = val.split('-')
  return `${m}/${y.slice(2)}`
}

function formatN3(val) {
  if (!val) return '—'
  return val.split('-')[0]
}

// Mesmas cores usadas nas telas de Situação/Histórico, em RGB porque o
// autoTable não entende classes CSS.
const COR_SITUACAO_PDF = {
  'Conforme':     { text: [22, 101, 52],  fill: [240, 253, 244] },
  'Alerta':       { text: [180, 83, 9],   fill: [255, 251, 235] },
  'Não Conforme': { text: [185, 28, 28],  fill: [254, 242, 242] },
}

const COR_TIPO_PDF = [
  { teste: /co²/i,     text: [180, 83, 9],   fill: [255, 251, 235] },
  { teste: /pqs bc/i,  text: [15, 118, 110], fill: [240, 253, 250] },
  { teste: /pqs abc/i, text: [109, 40, 217], fill: [245, 243, 255] },
  { teste: /água/i,    text: [162, 28, 175], fill: [253, 244, 255] },
]

const CHUMBO_PDF = [51, 65, 85]

// Encurta um texto com "…" no final se ele não couber na largura dada —
// evita que rótulos longos (ex: nome de um fator de não operacionalidade)
// invadam visualmente o valor ao lado.
function truncarTexto(doc, texto, larguraMax) {
  if (doc.getTextWidth(texto) <= larguraMax) return texto
  let t = texto
  while (t.length > 1 && doc.getTextWidth(t + '…') > larguraMax) {
    t = t.slice(0, -1)
  }
  return t + '…'
}

// Decide a cor de uma célula do corpo da tabela a partir da coluna (key) e
// do texto exibido — reproduz no PDF as mesmas etiquetas coloridas do app.
function estiloCelulaPdf(colKey, valor) {
  if (colKey === 'situacao') return COR_SITUACAO_PDF[valor] || null
  if (colKey === 'tipo_kg') return COR_TIPO_PDF.find(t => t.teste.test(valor)) || null
  if (colKey === 'nao_conformidade' && valor && valor !== '—') return { text: [185, 28, 28] }
  if (colKey === 'status') {
    if (/RESERVA/.test(valor)) return { text: [37, 99, 235], fill: [239, 246, 255] }
    if (/Manutenção/.test(valor)) return { text: [100, 116, 139], fill: [241, 245, 249] }
    if (/Alerta/.test(valor)) return { text: [180, 83, 9], fill: [255, 251, 235] }
  }
  return null
}

function didParseCellComCores(colunas) {
  return data => {
    if (data.section !== 'body') return
    const coluna = colunas[data.column.index]
    if (!coluna) return

    // Coluna Nº — fundo cinza claro com o número em vermelho e negrito,
    // igual ao destaque usado nas tabelas do app (fora do PDF).
    if (coluna.key === 'numero') {
      data.cell.styles.fillColor = [241, 245, 249]
      data.cell.styles.textColor = [220, 38, 38]
      data.cell.styles.fontStyle = 'bold'
      return
    }

    const estilo = estiloCelulaPdf(coluna.key, String(data.cell.raw))
    if (!estilo) return
    if (estilo.text) data.cell.styles.textColor = estilo.text
    if (estilo.fill) data.cell.styles.fillColor = estilo.fill
    if (coluna.key === 'situacao') data.cell.styles.fontStyle = 'bold'
  }
}

// Grade justificada de chips selecionáveis — usada pra escolha de colunas;
// cada botão ocupa a largura total da sua célula em vez de encolher pro
// tamanho do texto, evitando uma lista longa de uma linha por item.
function SeletorChips({ itens, ativos, onToggle }) {
  return (
    <div className="flex flex-wrap gap-2">
      {itens.map(item => {
        const sel = ativos.has(item.key)
        return (
          <button
            key={item.key}
            onClick={() => onToggle(item.key)}
            className={`text-xs px-2.5 py-1.5 rounded-lg border font-medium transition-colors ${
              sel ? 'bg-sci-red text-white border-sci-red' : 'bg-white text-slate-500 border-slate-200'
            }`}
          >
            {item.label}
          </button>
        )
      })}
    </div>
  )
}

function CabecalhoSelecao({ titulo, total, ativos, onTodos, onNenhum }) {
  return (
    <div className="flex items-center justify-between">
      <p className="text-xs text-sci-muted font-semibold uppercase tracking-wider">
        {titulo} <span className="text-slate-400 normal-case">({ativos}/{total})</span>
      </p>
      <div className="flex gap-2 text-xs font-medium">
        <button onClick={onTodos} className="text-sci-red">Todos</button>
        <button onClick={onNenhum} className="text-slate-400">Nenhum</button>
      </div>
    </div>
  )
}

// Ícone de olho aberto/fechado — seletor padrão de exibir/não exibir, usado
// em todos os cards de indicador abaixo.
function IconOlho({ aberto, size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 ${className}`}>
      {aberto ? (
        <>
          <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" />
          <circle cx="12" cy="12" r="3" />
        </>
      ) : (
        <>
          <path d="M9.88 9.88a3 3 0 104.24 4.24" />
          <path d="M10.73 5.08A10.43 10.43 0 0112 5c7 0 11 7 11 7a13.16 13.16 0 01-1.67 2.68M6.61 6.61A13.53 13.53 0 001 12s4 7 11 7a9.74 9.74 0 005.39-1.61" />
          <line x1="1" y1="1" x2="23" y2="23" />
        </>
      )}
    </svg>
  )
}

// Selo circular no canto do card indicando se ele entra no relatório —
// mesmo visual em todos os cards de indicador abaixo.
function SeloAtivo({ ativo }) {
  return (
    <span className="absolute top-3 right-3 shrink-0">
      <IconOlho aberto={ativo} className={ativo ? 'text-sci-red' : 'text-slate-300'} />
    </span>
  )
}

// Os quatro cards abaixo reproduzem, em miniatura, o mesmo visual dos cards
// do Dashboard (CardVistoria/CardConformidade/CardAlertas/Stat) — só que
// clicáveis pra incluir/excluir do relatório em vez de navegar.
function CardVistoriaIndicador({ ativo, onClick, total, vistoriados, naoVistoriados }) {
  return (
    <button onClick={onClick} className={`relative w-full p-4 rounded-2xl border border-slate-200 bg-white shadow-sm text-left transition-opacity ${ativo ? '' : 'opacity-40'}`}>
      <SeloAtivo ativo={ativo} />
      <div className="flex items-baseline gap-2 mb-3">
        <p className="text-2xl font-bold leading-none text-sci-text">{total}</p>
        <p className="text-[11px] text-slate-500 leading-tight">Total de extintores</p>
      </div>
      <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden flex gap-0.5 mb-3">
        {vistoriados > 0 && <div className="h-full bg-green-500 rounded-full" style={{ width: `${(vistoriados / total) * 100}%` }} />}
        {naoVistoriados > 0 && <div className="h-full bg-slate-300 rounded-full" style={{ width: `${(naoVistoriados / total) * 100}%` }} />}
      </div>
      <div className="flex items-center gap-4 text-xs text-slate-600">
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />Vistoriados <strong className="text-sci-text">{vistoriados}</strong></span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-slate-300 shrink-0" />Sem inspeção <strong className="text-sci-text">{naoVistoriados}</strong></span>
      </div>
    </button>
  )
}

// Igual ao CardVistoriaIndicador, mas com 3 categorias — corresponde ao
// gráfico de rosca "Conformidade" no PDF (Conforme/Não conforme/Sem inspeção).
function CardConformidadeIndicador({ ativo, onClick, conforme, naoConforme, semInspecao }) {
  const total = conforme + naoConforme + semInspecao
  return (
    <button onClick={onClick} className={`relative w-full p-4 rounded-2xl border border-slate-200 bg-white shadow-sm text-left transition-opacity ${ativo ? '' : 'opacity-40'}`}>
      <SeloAtivo ativo={ativo} />
      <p className="text-[11px] text-slate-500 leading-tight mb-2">Conformidade</p>
      <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden flex gap-0.5 mb-3">
        {conforme > 0 && <div className="h-full bg-green-500" style={{ width: `${(conforme / total) * 100}%` }} />}
        {naoConforme > 0 && <div className="h-full bg-sci-red" style={{ width: `${(naoConforme / total) * 100}%` }} />}
        {semInspecao > 0 && <div className="h-full bg-slate-300 rounded-full" style={{ width: `${(semInspecao / total) * 100}%` }} />}
      </div>
      <div className="flex items-center gap-4 text-xs text-slate-600 flex-wrap">
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />Conforme <strong className="text-sci-text">{conforme}</strong></span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-sci-red shrink-0" />Não conforme <strong className="text-sci-text">{naoConforme}</strong></span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-slate-300 shrink-0" />Sem inspeção <strong className="text-sci-text">{semInspecao}</strong></span>
      </div>
    </button>
  )
}

// Mesmo agrupamento da guia Depósito (SCI Operacional/Não operacional e
// RESERVA), somando quantidades — igual ao CardConformidadeIndicador em formato.
function CardEstoqueIndicador({ ativo, onClick, sciOk, sciNok, reserva }) {
  const total = sciOk + sciNok + reserva
  return (
    <button onClick={onClick} className={`relative w-full p-4 rounded-2xl border border-slate-200 bg-white shadow-sm text-left transition-opacity ${ativo ? '' : 'opacity-40'}`}>
      <SeloAtivo ativo={ativo} />
      <p className="text-[11px] text-slate-500 leading-tight mb-2">Estoque / Depósito</p>
      <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden flex gap-0.5 mb-3">
        {sciOk > 0 && <div className="h-full bg-green-500" style={{ width: `${(sciOk / total) * 100}%` }} />}
        {sciNok > 0 && <div className="h-full bg-amber-400" style={{ width: `${(sciNok / total) * 100}%` }} />}
        {reserva > 0 && <div className="h-full bg-blue-400 rounded-full" style={{ width: `${(reserva / total) * 100}%` }} />}
      </div>
      <div className="flex items-center gap-4 text-xs text-slate-600 flex-wrap">
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />SCI Operacional <strong className="text-sci-text">{sciOk}</strong></span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />SCI Não operacional <strong className="text-sci-text">{sciNok}</strong></span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-400 shrink-0" />RESERVA <strong className="text-sci-text">{reserva}</strong></span>
      </div>
    </button>
  )
}

function CardIndicador({ ativo, onClick, label, valor, cls }) {
  return (
    <button onClick={onClick} className={`relative w-full p-3 rounded-2xl border border-slate-200 bg-white shadow-sm text-left transition-opacity ${ativo ? '' : 'opacity-40'}`}>
      <SeloAtivo ativo={ativo} />
      <p className={`text-2xl font-bold leading-none ${cls}`}>{valor}</p>
      <p className="text-[11px] text-slate-500 leading-tight mt-1">{label}</p>
    </button>
  )
}

function CardAlertasIndicador({ grupos, ativos, onToggle }) {
  const totalGeral = grupos.reduce((s, g) => s + g.valor, 0)
  return (
    <div className="w-full p-4 rounded-2xl border border-slate-200 bg-white shadow-sm space-y-1">
      <div className="flex items-baseline gap-2">
        <p className="text-2xl font-bold leading-none text-amber-600">{totalGeral}</p>
        <p className="text-[11px] text-slate-500 leading-tight">Alertas</p>
      </div>
      <div className="divide-y divide-slate-100">
        {grupos.map(g => {
          const ativo = ativos.has(g.key)
          return (
            <button
              key={g.key}
              onClick={() => onToggle(g.key)}
              className={`w-full flex items-center gap-2.5 py-2.5 text-left transition-opacity ${ativo ? '' : 'opacity-40'}`}
            >
              <span className="text-sm text-slate-600 flex-1">{g.titulo}</span>
              <span className={`text-sm font-bold ${g.valor > 0 ? 'text-amber-600' : 'text-slate-300'}`}>{g.valor}</span>
              <span className="w-px h-4 bg-slate-200 shrink-0" />
              <IconOlho aberto={ativo} className={ativo ? 'text-sci-red' : 'text-slate-300'} />
            </button>
          )
        })}
      </div>
    </div>
  )
}

// Definição das colunas disponíveis por tabela — cada uma sabe extrair seu
// próprio valor da linha, usado tanto na UI de seleção quanto no PDF/preview.
// São fábricas (recebem tiposExtintor) porque a unidade (kg/L) depende do
// catálogo de tipos, carregado em tempo de execução.
function criarColunasSituacao(tiposExtintor) {
  return [
    { key: 'numero', label: 'Nº', get: ({ local, slot }) => String(local.numero).padStart(2, '0') + (local.tem_slot_a && local.tem_slot_b ? slot : '') },
    { key: 'local', label: 'Local', get: ({ local, slot }) => {
      const descSlot = local[`descricao_slot_${slot.toLowerCase()}`]
      const desc = [local.descricao, descSlot].filter(Boolean).join(' · ')
      return desc ? `${local.edificacao}\n${desc}` : local.edificacao
    } },
    { key: 'planta', label: 'Planta', get: ({ local }) => [local.planta_tipo_exigido, local.planta_cap_ext_exigida].filter(Boolean).join(' ') || '—' },
    { key: 'tipo_kg', label: 'Tipo/kg', get: ({ estado }) => estado.extintor_tipo ? `${estado.extintor_tipo} ${estado.extintor_kg || ''}${unidadeDoTipo(estado.extintor_tipo, tiposExtintor)}` : '—' },
    { key: 'situacao', label: 'Situação', get: ({ estado }) => estado.situacao_conformidade ? SITUACAO_LABEL[estado.situacao_conformidade] : '—' },
    { key: 'nao_conformidade', label: 'Não Conformidade', get: ({ estado }) => estado.motivo_nao_conformidade || '—' },
    { key: 'observacoes', label: 'Observações', get: ({ estado }) => estado.observacoes || '—' },
    { key: 'validade_n2', label: 'Val. N2', get: ({ estado }) => formatN2(estado.validade_nivel2) },
    { key: 'validade_n3', label: 'Val. N3', get: ({ estado }) => formatN3(estado.validade_nivel3) },
    { key: 'status', label: 'Status', get: ({ local, estado }) => [
      tipoDivergente(estado.extintor_tipo, local.planta_tipo_exigido) && 'Alerta',
      estado.reserva_empresa && 'RESERVA'
    ].filter(Boolean).join(', ') || '—' },
    { key: 'equipe', label: 'Equipe', get: ({ estado }) => estado.equipe_ultima_inspecao || '—' },
    { key: 'responsavel', label: 'Responsável', get: ({ estado }) => estado.responsavel_ultima_inspecao || '—' },
    { key: 'data', label: 'Data/Hora', get: ({ estado }) => formatDataHora(estado.data_ultima_inspecao) },
  ]
}

function criarColunasHistorico(tiposExtintor) {
  return [
  {
    key: 'numero', label: 'Nº', get: item => {
      if (!item.locais) return '—'
      const temDoisSlots = item.locais.tem_slot_a && item.locais.tem_slot_b
      return String(item.locais.numero).padStart(2, '0') + (temDoisSlots ? item.slot : '')
    }
  },
  { key: 'local', label: 'Local', get: item => {
    if (!item.locais) return 'Local removido'
    return item.locais.descricao ? `${item.locais.edificacao}\n${item.locais.descricao}` : item.locais.edificacao
  } },
  { key: 'planta', label: 'Planta', get: item => [item.locais?.planta_tipo_exigido, item.locais?.planta_cap_ext_exigida].filter(Boolean).join(' ') || '—' },
  { key: 'tipo_kg', label: 'Tipo/kg', get: item => item.payload?.extintor_tipo ? `${item.payload.extintor_tipo} ${item.payload.extintor_kg || ''}${unidadeDoTipo(item.payload.extintor_tipo, tiposExtintor)}` : '—' },
  { key: 'situacao', label: 'Situação', get: item => SITUACAO_LABEL[situacaoDoRegistroHistorico(item)] || '—' },
  { key: 'nao_conformidade', label: 'Não Conformidade', get: item => item.payload?.motivo_nao_conformidade || '—' },
  { key: 'observacoes', label: 'Observações', get: item => item.payload?.observacoes || '—' },
  { key: 'validade_n2', label: 'Val. N2', get: item => formatN2(item.payload?.validade_nivel2) },
  { key: 'validade_n3', label: 'Val. N3', get: item => formatN3(item.payload?.validade_nivel3) },
  { key: 'status', label: 'Status', get: item => [
    tipoDivergente(item.payload?.extintor_tipo, item.locais?.planta_tipo_exigido) && 'Alerta',
    item.payload?.reserva_empresa && 'RESERVA'
  ].filter(Boolean).join(', ') || '—' },
  { key: 'equipe', label: 'Equipe', get: item => item.equipe },
  { key: 'responsavel', label: 'Responsável', get: item => item.responsavel },
  { key: 'data', label: 'Data/Hora', get: item => formatDataHora(item.data_operacao) },
  ]
}

export default function Relatorios() {
  const showToast = useToast()
  const [locais, setLocais] = useState([])
  const [inicioPeriodo, setInicioPeriodo] = useState(null)
  const [historico, setHistorico] = useState([])
  const [tiposExtintor, setTiposExtintor] = useState([])
  const [ordensPendentes, setOrdensPendentes] = useState([])
  const [estoque, setEstoque] = useState([])
  const [loading, setLoading] = useState(true)
  const [gerando, setGerando] = useState(false)
  const [previewAberto, setPreviewAberto] = useState(false)
  const [previewUrl, setPreviewUrl] = useState(null)

  const [titulo, setTitulo] = useState('Relatório de Extintores')
  const [subtitulo, setSubtitulo] = useState('')
  const [orientacao, setOrientacao] = useState('paisagem')
  const [modoLista, setModoLista] = useState('situacao')
  const [mes, setMes] = useState('')
  const [inicioFiltro, setInicioFiltro] = useState('')
  const [fimFiltro, setFimFiltro] = useState('')
  const [observacoes, setObservacoes] = useState('')

  useEffect(() => {
    Promise.all([
      fetchLocaisComEstado(),
      fetchInicioPeriodoInspecao(),
      fetchHistoricoInspecoes(),
      fetchTiposExtintor(),
      fetchOrdensPendentes(),
      fetchEstoqueDeposito()
    ]).then(([locaisData, periodo, historicoData, tiposData, ordensData, estoqueData]) => {
      setLocais(locaisData)
      setInicioPeriodo(periodo)
      setHistorico(historicoData)
      setTiposExtintor(tiposData)
      setOrdensPendentes(ordensData)
      setEstoque(estoqueData)
    }).catch(e => console.error(e))
      .finally(() => setLoading(false))
  }, [])

  const COLUNAS_SITUACAO = criarColunasSituacao(tiposExtintor)
  const COLUNAS_HISTORICO = criarColunasHistorico(tiposExtintor)

  const linhas = locais.flatMap(local => {
    const slots = local.local_estado_atual || []
    return ['A', 'B']
      .filter(slot => slot === 'A' ? local.tem_slot_a : local.tem_slot_b)
      .map(slot => ({ local, slot, estado: slots.find(s => s.slot === slot) || {} }))
  })

  // Mesma segmentação usada no Dashboard, pra os indicadores do relatório
  // baterem exatamente com o que é exibido na página inicial.
  const linhasVistoriadas = linhas.filter(l =>
    l.estado.data_ultima_inspecao && (!inicioPeriodo || l.estado.data_ultima_inspecao >= inicioPeriodo)
  )
  const naoVistoriados = linhas.length - linhasVistoriadas.length
  const linhasConforme = linhas.filter(l => l.estado.situacao_conformidade === 'conforme')
  const linhasNaoConforme = linhas.filter(l => l.estado.situacao_conformidade === 'nao_conforme')
  // Diferente de "não vistoriados" (que considera o período/reset): aqui é
  // literalmente nunca ter recebido nenhuma inspeção — situação nunca foi definida.
  const linhasSemInspecaoConformidade = linhas.filter(l => !l.estado.situacao_conformidade)
  const linhasReserva = linhas.filter(l => l.estado.reserva_empresa)
  const linhasTipoDivergente = linhas.filter(l => tipoDivergente(l.estado.extintor_tipo, l.local.planta_tipo_exigido))
  const anoAtual = String(new Date().getFullYear())
  const linhasVencendoN2 = linhas.filter(l => {
    const dias = diasAte(l.estado.validade_nivel2)
    return dias !== null && dias < 90
  })
  const linhasVencendoN3 = linhas.filter(l => l.estado.validade_nivel3 && l.estado.validade_nivel3.startsWith(anoAtual))

  // Tipos de não conformidade — mesma categorização usada na guia Não
  // Conformidades (separarMotivos), pro card abaixo do gráfico Conformidade.
  const naoConformeVencidoN2 = linhas.filter(l => {
    const dias = diasAte(l.estado.validade_nivel2)
    return dias !== null && dias < 0
  })
  const naoConformeVencidoN3 = linhas.filter(l => {
    const dias = diasAte(l.estado.validade_nivel3)
    return dias !== null && dias < 0
  })
  // "Não operacional" não vira uma linha única — cada fator selecionado na
  // inspeção (ex: "Lacre violado", "Manômetro fora da faixa verde") é
  // listado e contado separadamente.
  const contagemFatoresOperacionais = {}
  linhasNaoConforme.forEach(l => {
    fatoresOperacionaisDoMotivo(l.estado.motivo_nao_conformidade).forEach(fator => {
      contagemFatoresOperacionais[fator] = (contagemFatoresOperacionais[fator] || 0) + 1
    })
  })
  const itensOperacionais = Object.entries(contagemFatoresOperacionais).map(([label, valor]) => ({ label, valor }))

  const DADOS_NAO_CONFORMIDADE = [
    { label: 'Capacidade extintora', valor: linhasNaoConforme.filter(l => separarMotivos(l.estado.motivo_nao_conformidade).capExt).length },
    ...itensOperacionais,
    { label: 'Validade N2 vencida', valor: naoConformeVencidoN2.length },
    { label: 'Validade N3 vencida', valor: naoConformeVencidoN3.length },
    { label: 'Sinalização', valor: linhasNaoConforme.filter(l => separarMotivos(l.estado.motivo_nao_conformidade).sinalizacao).length },
  ].filter(it => it.valor > 0)

  // Estoque/Depósito — mesmo agrupamento usado na guia Depósito (SCI
  // operacional/não operacional e RESERVA), somando as quantidades. Cada
  // linha ganha "chips" com a quebra por tipo/kg, coloridos como no resto
  // do app — cada chip é atômico (nunca quebra "tipo/kg" da quantidade).
  function chipsTipoKg(itensEstoque) {
    return itensEstoque
      .filter(e => e.quantidade > 0)
      .map(e => ({
        texto: `${e.tipo} ${e.kg}${unidadeDoTipo(e.tipo, tiposExtintor)}: ${e.quantidade}`,
        cor: COR_TIPO_PDF.find(t => t.teste.test(e.tipo)) || { text: [71, 85, 105], fill: [241, 245, 249] }
      }))
  }
  const estoqueSciOk = estoque.filter(e => e.categoria === 'SCI' && e.operacional).reduce((s, e) => s + e.quantidade, 0)
  const estoqueSciNok = estoque.filter(e => e.categoria === 'SCI' && !e.operacional).reduce((s, e) => s + e.quantidade, 0)
  const estoqueReservaTotal = estoque.filter(e => e.categoria === 'RESERVA').reduce((s, e) => s + e.quantidade, 0)
  const DADOS_ESTOQUE = [
    { label: 'SCI — Operacional', valor: estoqueSciOk, chips: chipsTipoKg(estoque.filter(e => e.categoria === 'SCI' && e.operacional)), cor: CHUMBO_PDF },
    { label: 'SCI — Não operacional', valor: estoqueSciNok, chips: chipsTipoKg(estoque.filter(e => e.categoria === 'SCI' && !e.operacional)), cor: CHUMBO_PDF },
    { label: 'RESERVA', valor: estoqueReservaTotal, chips: chipsTipoKg(estoque.filter(e => e.categoria === 'RESERVA')), cor: [37, 99, 235] },
  ].filter(it => it.valor > 0)

  // "Extintores em campo" e "Conformidade" viram gráficos de rosca no PDF em
  // vez de cards — cada array é uma fatia (label/valor/cor).
  const DADOS_GRAFICO_CAMPO = [
    { label: 'Vistoriados', valor: linhasVistoriadas.length, cor: [22, 163, 74] },
    { label: 'Não vistoriados', valor: naoVistoriados, cor: [148, 163, 184] },
  ]
  const DADOS_GRAFICO_CONFORMIDADE = [
    { label: 'Conforme', valor: linhasConforme.length, cor: [22, 163, 74] },
    { label: 'Não conforme', valor: linhasNaoConforme.length, cor: [220, 38, 38] },
    { label: 'Sem inspeção', valor: linhasSemInspecaoConformidade.length, cor: [148, 163, 184] },
  ]
  const totalConformidade = DADOS_GRAFICO_CONFORMIDADE.reduce((s, f) => s + f.valor, 0)

  // Alertas — viram um só card de lista no PDF, no lugar de três cards
  // separados. "grupo" decide se a linha aparece marcada.
  const ALERTA_PDF = [
    { label: 'Tipo divergente da planta', valor: linhasTipoDivergente.length, grupo: 'tipo_divergente' },
    { label: 'Validade N2 — próximos 90 dias', valor: linhasVencendoN2.length, grupo: 'validade_n2' },
    { label: 'Validade N3 — este ano', valor: linhasVencendoN3.length, grupo: 'validade_n3' },
  ]

  const GRUPOS_INDICADORES = ['campo', 'conformidade', 'estoque', 'tipo_divergente', 'validade_n2', 'validade_n3', 'em_manutencao', 'reserva']

  const [cardsAtivos, setCardsAtivos] = useState(() => new Set(GRUPOS_INDICADORES))
  const [colunasSituacaoAtivas, setColunasSituacaoAtivas] = useState(() => new Set(COLUNAS_SITUACAO.map(c => c.key)))
  const [colunasHistoricoAtivas, setColunasHistoricoAtivas] = useState(() => new Set(COLUNAS_HISTORICO.map(c => c.key)))

  function alternarNoSet(setState, key) {
    setState(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  function aplicarMes(valor) {
    setMes(valor)
    if (valor) {
      setInicioFiltro(`${valor}-01`)
      setFimFiltro(`${valor}-${String(ultimoDiaDoMes(valor)).padStart(2, '0')}`)
    }
  }

  const historicoFiltrado = historico.filter(item => {
    if (!inicioFiltro && !fimFiltro) return true
    const data = new Date(item.data_operacao)
    if (inicioFiltro && data < new Date(`${inicioFiltro}T00:00:00`)) return false
    if (fimFiltro && data > new Date(`${fimFiltro}T23:59:59`)) return false
    return true
  })

  // Mesmos dados usados tanto no preview em HTML quanto no PDF final — assim
  // o que aparece na tela é exatamente o que sai no arquivo.
  const colunasAtivas = modoLista === 'situacao'
    ? COLUNAS_SITUACAO.filter(c => colunasSituacaoAtivas.has(c.key))
    : COLUNAS_HISTORICO.filter(c => colunasHistoricoAtivas.has(c.key))
  const linhasParaTabela = modoLista === 'situacao' ? linhas : historicoFiltrado
  const alertaSelecionados = modoLista === 'situacao' ? ALERTA_PDF.filter(c => cardsAtivos.has(c.grupo)) : []
  const graficoCampoAtivo = modoLista === 'situacao' && cardsAtivos.has('campo')
  const graficoConformidadeAtivo = modoLista === 'situacao' && cardsAtivos.has('conformidade')
  const estoqueAtivo = modoLista === 'situacao' && cardsAtivos.has('estoque') && DADOS_ESTOQUE.length > 0
  const emManutencaoAtivo = modoLista === 'situacao' && cardsAtivos.has('em_manutencao')
  const reservaCampoAtivo = modoLista === 'situacao' && cardsAtivos.has('reserva')

  // Desenha uma fatia de rosca por vez, em polígono (leque de triângulos a
  // partir do centro) — jsPDF não tem arco/pizza nativo, então o caminho é
  // aproximar o arco com vários pontos e preencher.
  function desenharGraficoRosca(doc, cx, cy, raioExt, raioInt, fatias) {
    const total = fatias.reduce((s, f) => s + f.valor, 0)
    doc.setDrawColor(226, 232, 240)
    if (total <= 0) {
      doc.setFillColor(241, 245, 249)
      doc.circle(cx, cy, raioExt, 'FD')
      doc.setFillColor(255, 255, 255)
      doc.circle(cx, cy, raioInt, 'F')
      return
    }
    let anguloAtual = -Math.PI / 2
    fatias.forEach(f => {
      if (f.valor <= 0) return
      const anguloFatia = (f.valor / total) * Math.PI * 2
      const passos = Math.max(1, Math.ceil((anguloFatia / (Math.PI * 2)) * 120))
      const pontos = []
      for (let i = 0; i <= passos; i++) {
        const a = anguloAtual + (anguloFatia * i) / passos
        pontos.push([cx + raioExt * Math.cos(a), cy + raioExt * Math.sin(a)])
      }
      doc.setFillColor(...f.cor)
      const segs = []
      let curX = cx, curY = cy
      pontos.forEach(p => { segs.push([p[0] - curX, p[1] - curY]); curX = p[0]; curY = p[1] })
      segs.push([cx - curX, cy - curY])
      doc.lines(segs, cx, cy, [1, 1], 'F', true)
      anguloAtual += anguloFatia
    })
    doc.setFillColor(255, 255, 255)
    doc.circle(cx, cy, raioInt, 'F')
  }

  // Card com gráfico de rosca à esquerda + legenda (quadrado colorido,
  // rótulo, valor) à direita — usado pra "Extintores em campo" e
  // "Conformidade" no lugar dos cards simples de indicador.
  function desenharCardGrafico(doc, x, y, w, h, titulo, fatias, totalCentral, rodape) {
    doc.setDrawColor(226, 232, 240)
    doc.setFillColor(255, 255, 255)
    doc.roundedRect(x, y, w, h, 3, 3, 'FD')

    // Título fica numa faixa compacta no topo — não disputa altura com o
    // gráfico/legenda, que ficam centralizados no espaço restante abaixo dele.
    const headerH = 6
    doc.setFont(undefined, 'bold')
    doc.setFontSize(9)
    doc.setTextColor(30, 41, 59)
    doc.text(titulo, x + w / 2, y + 6, { align: 'center' })

    const areaY = y + headerH
    const areaH = h - headerH
    const raioExt = 14
    const raioInt = 10.5
    const cx = x + 24
    const cy = areaY + areaH / 2

    desenharGraficoRosca(doc, cx, cy, raioExt, raioInt, fatias)

    if (totalCentral != null) {
      doc.setFont(undefined, 'bold')
      doc.setFontSize(11)
      doc.setTextColor(30, 41, 59)
      doc.text(String(totalCentral), cx, cy, { align: 'center' })

      doc.setFont(undefined, 'normal')
      doc.setFontSize(5.5)
      doc.setTextColor(148, 163, 184)
      doc.text('TOTAL', cx, cy + 4, { align: 'center' })
    }

    const linhaAltura = 7
    let ly = areaY + Math.max(5, (areaH - fatias.length * linhaAltura) / 2 + 5)
    fatias.forEach(f => {
      doc.setFillColor(...f.cor)
      doc.rect(x + 46, ly - 3, 3, 3, 'F')
      doc.setFont(undefined, 'normal')
      doc.setFontSize(8)
      doc.setTextColor(71, 85, 105)
      doc.text(f.label, x + 51, ly)
      doc.setFont(undefined, 'bold')
      doc.setTextColor(30, 41, 59)
      doc.text(String(f.valor), x + w - 5, ly, { align: 'right' })
      ly += linhaAltura
    })

    if (rodape) {
      // Selo em destaque (fundo vermelho, texto branco) — chama mais
      // atenção que um texto solto em cinza.
      doc.setFont(undefined, 'bold')
      doc.setFontSize(6)
      const padX = 2.2
      const textW = doc.getTextWidth(rodape)
      const badgeH = 4.5
      // Alinha o texto de dentro do selo (não a borda do selo) com o
      // início do texto das linhas da legenda, em x + 51.
      const badgeX = x + 51 - padX
      const badgeY = ly - 3.3
      doc.setFillColor(220, 38, 38)
      doc.roundedRect(badgeX, badgeY, textW + padX * 2, badgeH, 1.2, 1.2, 'F')
      doc.setTextColor(255, 255, 255)
      doc.text(rodape, badgeX + padX, ly - 0.3)
      doc.setFont(undefined, 'normal')
    }
  }

  // Posiciona uma linha de "chips" (retângulo colorido + texto) que quebra
  // pra próxima linha quando não cabe — cada chip é atômico, nunca quebra
  // no meio (ex: "CO² 6kg: 9" não separa o tipo/kg da quantidade). Só
  // calcula posições (não desenha), pra poder reaproveitar tanto na medida
  // de altura quanto no desenho de verdade.
  function layoutChips(doc, w, chips) {
    doc.setFontSize(6.5)
    const alturaChip = 4.3
    const gap = 1.5
    const padX = 1.3
    let cx = 0
    let cy = 0
    const posicionados = chips.map(chip => {
      const largura = doc.getTextWidth(chip.texto) + padX * 2
      if (cx + largura > w && cx > 0) {
        cx = 0
        cy += alturaChip + 1
      }
      const pos = { ...chip, x: cx, y: cy, largura }
      cx += largura + gap
      return pos
    })
    return { posicionados, alturaTotal: cy + alturaChip }
  }

  // Retângulo com raio independente por canto — jsPDF só desenha raio
  // uniforme nos 4 cantos, então reconstrói o mesmo algoritmo (curva Bézier
  // aproximando um quarto de círculo, com o fator "kappa") permitindo cada
  // canto ter seu próprio raio (0 = canto reto).
  function desenharRetanguloCantos(doc, x, y, w, h, rTL, rTR, rBR, rBL, style) {
    const k = 0.5523
    doc.lines([
      [w - rTL - rTR, 0],
      [rTR * k, 0, rTR, rTR - rTR * k, rTR, rTR],
      [0, h - rTR - rBR],
      [0, rBR * k, -rBR + rBR * k, rBR, -rBR, rBR],
      [-(w - rBR - rBL), 0],
      [-rBL * k, 0, -rBL, -rBL + rBL * k, -rBL, -rBL],
      [0, -(h - rBL - rTL)],
      [0, -rTL * k, rTL - rTL * k, -rTL, rTL, -rTL]
    ], x + rTL, y, [1, 1], style, true)
  }

  // Chip "composto" — dois trechos colados formando uma única pílula: o
  // local (vermelho/cinza claro, igual à coluna Nº da tabela) com bordas
  // arredondadas só à esquerda, e o tipo/kg (colorido por tipo) com bordas
  // arredondadas só à direita. Usado na lista de locais em RESERVA.
  function layoutChipsCompostos(doc, w, itens) {
    doc.setFontSize(6.5)
    const alturaChip = 4.3
    const gap = 1.5
    const padX = 1.3
    let cx = 0
    let cy = 0
    const posicionados = itens.map(it => {
      const localW = doc.getTextWidth(it.local) + padX * 2
      const tipoW = doc.getTextWidth(it.tipoKg) + padX * 2
      const totalW = localW + tipoW
      if (cx + totalW > w && cx > 0) {
        cx = 0
        cy += alturaChip + 1
      }
      const pos = { ...it, x: cx, y: cy, localW, tipoW }
      cx += totalW + gap
      return pos
    })
    return { posicionados, alturaTotal: cy + alturaChip }
  }

  function desenharChipsCompostos(doc, x, y, posicionados) {
    const r = 0.8
    const alturaChip = 4.3
    posicionados.forEach(it => {
      const px = x + it.x
      const py = y + it.y

      doc.setFillColor(241, 245, 249)
      desenharRetanguloCantos(doc, px, py, it.localW, alturaChip, r, 0, 0, r, 'F')
      doc.setFillColor(...it.corTipo.fill)
      desenharRetanguloCantos(doc, px + it.localW, py, it.tipoW, alturaChip, 0, r, r, 0, 'F')

      doc.setFont(undefined, 'bold')
      doc.setFontSize(6.5)
      doc.setTextColor(220, 38, 38)
      doc.text(it.local, px + 1.3, py + alturaChip - 1.1)

      doc.setFont(undefined, 'normal')
      doc.setTextColor(...it.corTipo.text)
      doc.text(it.tipoKg, px + it.localW + 1.3, py + alturaChip - 1.1)
    })
  }

  // Card de lista (título + total no topo, uma linha por item abaixo,
  // separadas por um traço fino) — usado pra "Alertas", "Não conformidade",
  // "Estoque/Depósito", "Em manutenção" e "RESERVA em campo", no lugar de
  // vários cards soltos com um número cada. Cada item pode ter "chips" (ex:
  // quebra por tipo/kg) numa segunda linha; o card também pode ter "chips"
  // gerais direto abaixo do cabeçalho (sem itens de linha, ex: lista de
  // locais em RESERVA) e uma mensagem centralizada pra quando não há nada.
  // A altura depende do texto real (pode quebrar em mais de uma linha),
  // por isso depende de `doc` e da largura final da coluna.
  function alturaCardLista(doc, itens, w, opts = {}) {
    let h = 12 + 6.5
    itens.forEach(it => {
      h += 6.5
      if (it.chips && it.chips.length) {
        h += layoutChips(doc, w - 10, it.chips).alturaTotal + 1
      }
    })
    const temChipsGerais = (opts.chips && opts.chips.length) || (opts.chipsCompostos && opts.chipsCompostos.length)
    if (opts.chips && opts.chips.length) {
      h += layoutChips(doc, w - 10, opts.chips).alturaTotal + 1
    }
    if (opts.chipsCompostos && opts.chipsCompostos.length) {
      h += layoutChipsCompostos(doc, w - 10, opts.chipsCompostos).alturaTotal + 1
    }
    if (itens.length === 0 && !temChipsGerais && opts.mensagemVazia) {
      h = Math.max(h, 26)
    }
    return h
  }

  function desenharCardLista(doc, x, y, w, h, titulo, itens, corTotal, valorPrimeiro, totalOverride, opts = {}) {
    doc.setDrawColor(226, 232, 240)
    doc.setFillColor(255, 255, 255)
    doc.roundedRect(x, y, w, h, 3, 3, 'FD')

    const totalGeral = totalOverride != null ? totalOverride : itens.reduce((s, it) => s + it.valor, 0)
    doc.setFont(undefined, 'bold')
    doc.setFontSize(11)
    doc.setTextColor(...corTotal)
    doc.text(String(totalGeral), x + 5, y + 8)

    doc.setFont(undefined, 'normal')
    doc.setFontSize(7)
    doc.setTextColor(100, 116, 139)
    doc.text(titulo, x + 5 + doc.getTextWidth(String(totalGeral)) + 2.5, y + 8)

    const temChipsGerais = (opts.chips && opts.chips.length) || (opts.chipsCompostos && opts.chipsCompostos.length)
    if (itens.length === 0 && !temChipsGerais) {
      if (opts.mensagemVazia) {
        doc.setFont(undefined, 'normal')
        doc.setFontSize(7)
        doc.setTextColor(148, 163, 184)
        doc.text(opts.mensagemVazia, x + w / 2, y + h / 2 + 6, { align: 'center' })
      }
      return
    }

    // Espaço entre o cabeçalho (número + título) e o conteúdo abaixo —
    // um pouco maior que a distância entre linhas, pra separar bem os blocos.
    let ly = y + 18
    itens.forEach((it, i) => {
      if (i > 0) {
        doc.setDrawColor(241, 245, 249)
        doc.line(x + 5, ly - 4.7, x + w - 5, ly - 4.7)
      }
      doc.setFontSize(8)
      const corValor = it.cor || corTotal
      const larguraValor = doc.getTextWidth(String(it.valor))
      if (valorPrimeiro) {
        doc.setFont(undefined, 'bold')
        doc.setTextColor(...corValor)
        doc.text(String(it.valor), x + 5, ly)
        doc.setFont(undefined, 'normal')
        doc.setTextColor(71, 85, 105)
        doc.text(truncarTexto(doc, it.label, w - 12 - 5), x + 12, ly)
      } else {
        doc.setFont(undefined, 'normal')
        doc.setTextColor(71, 85, 105)
        doc.text(truncarTexto(doc, it.label, w - 10 - larguraValor - 3), x + 5, ly)
        doc.setFont(undefined, 'bold')
        doc.setTextColor(...corValor)
        doc.text(String(it.valor), x + w - 5, ly, { align: 'right' })
      }
      ly += 6.5

      if (it.chips && it.chips.length) {
        const { posicionados, alturaTotal } = layoutChips(doc, w - 10, it.chips)
        const baseY = ly - 3.2
        posicionados.forEach(chip => {
          doc.setFillColor(...chip.cor.fill)
          doc.roundedRect(x + 5 + chip.x, baseY + chip.y - 3.1, chip.largura, 4.3, 0.8, 0.8, 'F')
          doc.setFont(undefined, 'normal')
          doc.setFontSize(6.5)
          doc.setTextColor(...chip.cor.text)
          doc.text(chip.texto, x + 5 + chip.x + 1.3, baseY + chip.y)
        })
        ly += alturaTotal + 1
      }
    })

    if (opts.chips && opts.chips.length) {
      const { posicionados } = layoutChips(doc, w - 10, opts.chips)
      const baseY = ly - 3.2
      posicionados.forEach(chip => {
        doc.setFillColor(...chip.cor.fill)
        doc.roundedRect(x + 5 + chip.x, baseY + chip.y - 3.1, chip.largura, 4.3, 0.8, 0.8, 'F')
        doc.setFont(undefined, 'normal')
        doc.setFontSize(6.5)
        doc.setTextColor(...chip.cor.text)
        doc.text(chip.texto, x + 5 + chip.x + 1.3, baseY + chip.y)
      })
    }

    if (opts.chipsCompostos && opts.chipsCompostos.length) {
      const { posicionados } = layoutChipsCompostos(doc, w - 10, opts.chipsCompostos)
      desenharChipsCompostos(doc, x + 5, ly - 6.3, posicionados)
    }
  }

  // Monta o PDF de verdade (jsPDF) — usado tanto pro preview (renderizado
  // num iframe, o navegador é quem desenha) quanto pro arquivo emitido, pra
  // não existir risco de o preview destoar do PDF real.
  function construirDocumento() {
    const doc = new jsPDF({ orientation: orientacao === 'paisagem' ? 'landscape' : 'portrait' })
    const margem = 14
    const larguraUtil = doc.internal.pageSize.getWidth() - margem * 2
    const alturaPagina = doc.internal.pageSize.getHeight()
    let y = 18

    doc.setFontSize(18)
    doc.setTextColor(20)
    doc.text(titulo || 'Relatório', margem, y)

    doc.setFontSize(9)
    doc.setTextColor(140)
    doc.text(`Emitido em ${new Date().toLocaleString('pt-BR')}`, margem + larguraUtil, y, { align: 'right' })
    doc.setTextColor(20)
    y += 9

    if (subtitulo.trim()) {
      doc.setFontSize(11)
      doc.setTextColor(90)
      doc.text(subtitulo, margem, y)
      y += 7
    }
    y += 5

    const gapCard = 4
    if (graficoCampoAtivo || graficoConformidadeAtivo || estoqueAtivo || alertaSelecionados.length || emManutencaoAtivo || reservaCampoAtivo) {
      // "Conformidade" e "Extintores em campo" — gráficos de rosca lado a
      // lado na mesma linha, no lugar dos cards simples.
      if (graficoCampoAtivo || graficoConformidadeAtivo) {
        const chartH = 42

        const periodoTexto = 'Dentro do período atual'

        const halfW = (larguraUtil - gapCard) / 2
        if (graficoCampoAtivo && graficoConformidadeAtivo) {
          desenharCardGrafico(doc, margem, y, halfW, chartH, 'Conformidade', DADOS_GRAFICO_CONFORMIDADE, totalConformidade)
          desenharCardGrafico(doc, margem + halfW + gapCard, y, halfW, chartH, 'Extintores em campo', DADOS_GRAFICO_CAMPO, linhas.length, periodoTexto)
        } else if (graficoConformidadeAtivo) {
          desenharCardGrafico(doc, margem, y, larguraUtil, chartH, 'Conformidade', DADOS_GRAFICO_CONFORMIDADE, totalConformidade)
        } else {
          desenharCardGrafico(doc, margem, y, larguraUtil, chartH, 'Extintores em campo', DADOS_GRAFICO_CAMPO, linhas.length, periodoTexto)
        }
        y += chartH + gapCard
      }

      // "Não conformidade" (abaixo do gráfico Conformidade, só os tipos com
      // 1 ou mais ocorrência), "Alertas" e "Em manutenção" — cards de lista
      // lado a lado, dividindo a largura entre quantos estiverem ativos.
      // "Em manutenção" não tem sub-itens — só número e título na mesma
      // linha, como o cabeçalho dos outros cards de lista (e uma mensagem
      // centralizada quando não há nenhum registro).
      const naoConformidadeAtiva = graficoConformidadeAtivo && DADOS_NAO_CONFORMIDADE.length > 0
      const cartoesLista = []
      if (naoConformidadeAtiva) cartoesLista.push({ titulo: 'Não conformidades', itens: DADOS_NAO_CONFORMIDADE, cor: [220, 38, 38], valorPrimeiro: false })
      if (alertaSelecionados.length) cartoesLista.push({ titulo: 'Alertas', itens: alertaSelecionados, cor: [217, 119, 6], valorPrimeiro: false })
      if (emManutencaoAtivo) {
        cartoesLista.push({
          titulo: 'Em manutenção', itens: [], cor: CHUMBO_PDF, valorPrimeiro: false, total: ordensPendentes.length,
          opts: ordensPendentes.length === 0 ? { mensagemVazia: 'Não há nenhum registro de envio' } : {}
        })
      }

      // Largura de cada card dessa linha — guardada fora do bloco pra o
      // card de Estoque (2/3), logo abaixo, poder alinhar sua borda direita
      // exatamente com o fim do 2º card desta linha.
      let colWCartoesLista = null
      if (cartoesLista.length) {
        colWCartoesLista = (larguraUtil - gapCard * (cartoesLista.length - 1)) / cartoesLista.length
        const listaH = Math.max(...cartoesLista.map(c => alturaCardLista(doc, c.itens, colWCartoesLista, c.opts)))

        cartoesLista.forEach((c, i) => {
          desenharCardLista(doc, margem + i * (colWCartoesLista + gapCard), y, colWCartoesLista, listaH, c.titulo, c.itens, c.cor, c.valorPrimeiro, c.total, c.opts)
        })
        y += listaH + gapCard
      }

      // "Estoque/Depósito" e "RESERVA em campo" — dividem a última linha do
      // resumo. A largura do Estoque acompanha o fim do 2º card da linha de
      // cima (quando ela existe com 2+ cards); "RESERVA em campo" ocupa o
      // restante, também com número/título numa linha só e a lista de
      // locais (com tipo/kg) como chips abaixo.
      if (estoqueAtivo || reservaCampoAtivo) {
        const temAmbos = estoqueAtivo && reservaCampoAtivo
        const colWEstoque = temAmbos
          ? (colWCartoesLista != null && cartoesLista.length >= 2
              ? colWCartoesLista * 2 + gapCard
              : (larguraUtil - gapCard) * (2 / 3))
          : larguraUtil
        const colWReserva = larguraUtil - gapCard - colWEstoque

        const chipsReserva = linhasReserva.map(l => {
          const numero = String(l.local.numero).padStart(2, '0') + (l.local.tem_slot_a && l.local.tem_slot_b ? l.slot : '')
          const tipoKg = l.estado.extintor_tipo ? `${l.estado.extintor_tipo} ${l.estado.extintor_kg || ''}${unidadeDoTipo(l.estado.extintor_tipo, tiposExtintor)}` : '—'
          return {
            local: numero,
            tipoKg,
            corTipo: COR_TIPO_PDF.find(t => t.teste.test(l.estado.extintor_tipo)) || { text: [71, 85, 105], fill: [241, 245, 249] }
          }
        })
        const reservaOpts = { chipsCompostos: chipsReserva, mensagemVazia: chipsReserva.length === 0 ? 'Nenhum extintor em RESERVA no momento' : null }

        const alturas = []
        if (estoqueAtivo) alturas.push(alturaCardLista(doc, DADOS_ESTOQUE, colWEstoque))
        if (reservaCampoAtivo) alturas.push(alturaCardLista(doc, [], temAmbos ? colWReserva : larguraUtil, reservaOpts))
        const alturaLinha = Math.max(...alturas)

        if (estoqueAtivo) {
          desenharCardLista(doc, margem, y, colWEstoque, alturaLinha, 'Estoque / Depósito', DADOS_ESTOQUE, CHUMBO_PDF, false)
        }
        if (reservaCampoAtivo) {
          const xReserva = estoqueAtivo ? margem + colWEstoque + gapCard : margem
          const wReserva = estoqueAtivo ? colWReserva : larguraUtil
          desenharCardLista(doc, xReserva, y, wReserva, alturaLinha, 'RESERVA em campo', [], [37, 99, 235], false, linhasReserva.length, reservaOpts)
        }
        y += alturaLinha + gapCard
      }

      doc.setFont(undefined, 'normal')
      doc.setTextColor(20)
      y += 10
    }

    // Evita começar a tabela na página 1 com só um punhado de linhas antes
    // de virar — se sobrar espaço pra menos de 5, já pula pra próxima página.
    const alturaLinhaEstimada = 9
    const alturaCabecalhoTabela = 9 + 4
    const espacoDisponivel = alturaPagina - y - 20
    const linhasQueCabem = Math.floor((espacoDisponivel - alturaCabecalhoTabela) / alturaLinhaEstimada)
    if (doc.internal.getNumberOfPages() === 1 && linhasParaTabela.length > 0 && linhasQueCabem < 5) {
      doc.addPage()
      y = 18
    }

    doc.setFontSize(13)
    doc.text(
      modoLista === 'situacao'
        ? 'Situação atual'
        : 'Histórico de inspeções' + (inicioFiltro || fimFiltro ? ' (período filtrado)' : ''),
      margem, y
    )
    y += 4
    autoTable(doc, {
      startY: y,
      head: [colunasAtivas.map(c => c.label)],
      body: linhasParaTabela.map(linha => colunasAtivas.map(c => c.get(linha))),
      theme: 'grid',
      // Uma linha inteira pula pra próxima página em vez de ser cortada
      // no meio (ex: a célula de duas linhas de Local).
      rowPageBreak: 'avoid',
      headStyles: { fillColor: [220, 38, 38], halign: 'center', valign: 'middle' },
      margin: { left: margem, right: margem },
      styles: { fontSize: 8, halign: 'center', valign: 'middle' },
      // Todas as colunas centralizadas, exceto "Local" — texto mais longo e
      // variável, fica melhor alinhado à esquerda.
      columnStyles: Object.fromEntries(
        colunasAtivas.map((c, i) => [i, { halign: c.key === 'local' ? 'left' : 'center' }])
      ),
      didParseCell: didParseCellComCores(colunasAtivas)
    })
    y = doc.lastAutoTable.finalY + 10

    if (observacoes.trim()) {
      if (y > alturaPagina - 35) { doc.addPage(); y = 18 }
      doc.setFontSize(13)
      doc.setTextColor(20)
      doc.text('Observações', margem, y)
      y += 6
      doc.setFontSize(10)
      doc.setTextColor(60)
      const linhasTexto = doc.splitTextToSize(observacoes.trim(), larguraUtil)
      doc.text(linhasTexto, margem, y)
    }

    return doc
  }

  function gerarPdf() {
    setGerando(true)
    try {
      const doc = construirDocumento()
      const nomeArquivo = (titulo || 'relatorio').toLowerCase().trim()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'relatorio'
      doc.save(`${nomeArquivo}.pdf`)
      showToast('Relatório emitido com sucesso.')
      setPreviewAberto(false)
    } catch (e) {
      showToast('Erro ao gerar PDF: ' + e.message, 'erro')
    } finally {
      setGerando(false)
    }
  }

  // Preview real — o PDF de verdade é (re)gerado como blob e mostrado num
  // iframe (o navegador usa o próprio visualizador de PDF). Debounced pra
  // não reconstruir o documento a cada tecla digitada.
  const previewUrlRef = useRef(null)
  useEffect(() => {
    if (loading) return
    const timer = setTimeout(() => {
      try {
        const doc = construirDocumento()
        const url = doc.output('bloburl')
        if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
        previewUrlRef.current = url
        setPreviewUrl(url)
      } catch (e) {
        console.error(e)
      }
    }, 400)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    loading, titulo, subtitulo, orientacao, modoLista, cardsAtivos,
    colunasSituacaoAtivas, colunasHistoricoAtivas, observacoes,
    inicioFiltro, fimFiltro, locais, historico, tiposExtintor, ordensPendentes
  ])

  useEffect(() => () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
  }, [])

  if (loading) return <div className="p-4 text-sm text-slate-500">Carregando...</div>

  return (
    <div className="lg:flex lg:items-start lg:gap-6 lg:p-4">
      <div className="p-4 lg:p-0 lg:w-1/2 space-y-5">

        {/* Título e subtítulo */}
        <div className="space-y-3">
          <p className="text-xs text-sci-muted font-semibold uppercase tracking-wider">Cabeçalho</p>
          <div>
            <label className="text-xs text-slate-400">Título</label>
            <input type="text" value={titulo} onChange={e => setTitulo(e.target.value)} className="w-full mt-1" />
          </div>
          <div>
            <label className="text-xs text-slate-400">Subtítulo (opcional)</label>
            <input type="text" value={subtitulo} onChange={e => setSubtitulo(e.target.value)}
              placeholder="ex: Julho de 2026" className="w-full mt-1" />
          </div>
          <div>
            <label className="text-xs text-slate-400">Orientação da página</label>
            <div className="flex gap-2 mt-1">
              <button
                onClick={() => setOrientacao('paisagem')}
                className={`btn-option flex-1 text-sm ${orientacao === 'paisagem' ? 'selected' : ''}`}
              >
                Paisagem
              </button>
              <button
                onClick={() => setOrientacao('retrato')}
                className={`btn-option flex-1 text-sm ${orientacao === 'retrato' ? 'selected' : ''}`}
              >
                Retrato
              </button>
            </div>
          </div>
        </div>

        {/* Lista a incluir */}
        <div className="space-y-2">
          <p className="text-xs text-sci-muted font-semibold uppercase tracking-wider">Lista a incluir</p>
          <div className="flex gap-2">
            <button
              onClick={() => setModoLista('situacao')}
              className={`btn-option flex-1 text-sm ${modoLista === 'situacao' ? 'selected' : ''}`}
            >
              Situação atual ({linhas.length})
            </button>
            <button
              onClick={() => setModoLista('historico')}
              className={`btn-option flex-1 text-sm ${modoLista === 'historico' ? 'selected' : ''}`}
            >
              Histórico ({historicoFiltrado.length})
            </button>
          </div>

          {modoLista === 'historico' && (
            <div className="card space-y-2 py-3">
              <div>
                <label className="text-xs text-slate-400">Mês</label>
                <input type="month" value={mes} onChange={e => aplicarMes(e.target.value)} className="w-full mt-1" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-slate-400">ou início</label>
                  <input type="date" value={inicioFiltro} onChange={e => { setMes(''); setInicioFiltro(e.target.value) }} className="w-full mt-1" />
                </div>
                <div>
                  <label className="text-xs text-slate-400">término</label>
                  <input type="date" value={fimFiltro} onChange={e => { setMes(''); setFimFiltro(e.target.value) }} className="w-full mt-1" />
                </div>
              </div>
            </div>
          )}

          {(() => {
            const colunasDisponiveis = modoLista === 'situacao' ? COLUNAS_SITUACAO : COLUNAS_HISTORICO
            const ativas = modoLista === 'situacao' ? colunasSituacaoAtivas : colunasHistoricoAtivas
            const setAtivas = modoLista === 'situacao' ? setColunasSituacaoAtivas : setColunasHistoricoAtivas
            return (
              <div className="space-y-2 pt-1">
                <CabecalhoSelecao
                  titulo="Colunas da tabela"
                  total={colunasDisponiveis.length}
                  ativos={ativas.size}
                  onTodos={() => setAtivas(new Set(colunasDisponiveis.map(c => c.key)))}
                  onNenhum={() => setAtivas(new Set())}
                />
                <SeletorChips itens={colunasDisponiveis} ativos={ativas} onToggle={key => alternarNoSet(setAtivas, key)} />
              </div>
            )
          })()}
        </div>

        {/* Indicadores — só faz sentido pra Situação atual (contagens do
            momento presente; histórico é uma lista de eventos passados) */}
        {modoLista === 'situacao' && (
          <div className="space-y-5">
            <div className="space-y-2">
              <p className="text-xs text-sci-muted font-semibold uppercase tracking-wider">Extintores em campo</p>
              <CardVistoriaIndicador
                ativo={cardsAtivos.has('campo')}
                onClick={() => alternarNoSet(setCardsAtivos, 'campo')}
                total={linhas.length}
                vistoriados={linhasVistoriadas.length}
                naoVistoriados={naoVistoriados}
              />
            </div>

            <div className="space-y-2">
              <p className="text-xs text-sci-muted font-semibold uppercase tracking-wider">Conformidade</p>
              <CardConformidadeIndicador
                ativo={cardsAtivos.has('conformidade')}
                onClick={() => alternarNoSet(setCardsAtivos, 'conformidade')}
                conforme={linhasConforme.length}
                naoConforme={linhasNaoConforme.length}
                semInspecao={linhasSemInspecaoConformidade.length}
              />
            </div>

            <div className="space-y-2">
              <p className="text-xs text-sci-muted font-semibold uppercase tracking-wider">Estoque / Depósito</p>
              <CardEstoqueIndicador
                ativo={cardsAtivos.has('estoque')}
                onClick={() => alternarNoSet(setCardsAtivos, 'estoque')}
                sciOk={estoqueSciOk}
                sciNok={estoqueSciNok}
                reserva={estoqueReservaTotal}
              />
            </div>

            <div className="space-y-2">
              <p className="text-xs text-sci-muted font-semibold uppercase tracking-wider">Alertas</p>
              <CardAlertasIndicador
                grupos={[
                  { key: 'tipo_divergente', titulo: 'Tipo divergente da planta', valor: linhasTipoDivergente.length },
                  { key: 'validade_n2', titulo: 'Validade N2 — próximos 90 dias', valor: linhasVencendoN2.length },
                  { key: 'validade_n3', titulo: 'Validade N3 — este ano', valor: linhasVencendoN3.length },
                ]}
                ativos={cardsAtivos}
                onToggle={key => alternarNoSet(setCardsAtivos, key)}
              />
            </div>

            <div className="space-y-2">
              <p className="text-xs text-sci-muted font-semibold uppercase tracking-wider">Outros indicadores</p>
              <div className="grid grid-cols-2 gap-3">
                <CardIndicador
                  label="Em manutenção" valor={ordensPendentes.length} cls="text-slate-500"
                  ativo={cardsAtivos.has('em_manutencao')} onClick={() => alternarNoSet(setCardsAtivos, 'em_manutencao')}
                />
                <CardIndicador
                  label="RESERVA em campo" valor={linhasReserva.length} cls="text-blue-600"
                  ativo={cardsAtivos.has('reserva')} onClick={() => alternarNoSet(setCardsAtivos, 'reserva')}
                />
              </div>
            </div>
          </div>
        )}

        {/* Observações finais */}
        <div className="space-y-2">
          <p className="text-xs text-sci-muted font-semibold uppercase tracking-wider">Observações finais (opcional)</p>
          <textarea
            value={observacoes}
            onChange={e => setObservacoes(e.target.value)}
            placeholder="Texto livre exibido no final do relatório."
            rows={4}
            className="w-full resize-none"
          />
        </div>

        {/* Telas estreitas: botão que abre o preview num modal */}
        <button
          onClick={() => setPreviewAberto(true)}
          className="btn-primary w-full lg:hidden"
        >
          Visualizar relatório
        </button>
      </div>

      {/* Telas largas (≥1024px): metade da tela é o preview fixo, com o
          botão de emitir logo abaixo dele. */}
      <div className="hidden lg:flex lg:flex-col lg:w-1/2 lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)] lg:gap-3">
        <div className="flex-1 min-h-0 border border-slate-200 rounded-2xl bg-white shadow-sm overflow-hidden">
          {previewUrl ? (
            <iframe title="Preview do relatório" src={previewUrl} className="w-full h-full border-0" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-sm text-slate-400">Gerando preview...</div>
          )}
        </div>
        <button
          onClick={gerarPdf}
          disabled={gerando}
          className="btn-primary w-full shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {gerando ? 'Gerando...' : 'Emitir relatório em PDF'}
        </button>
      </div>

      {/* Telas estreitas: preview + emitir dentro de um modal */}
      {previewAberto && (
        <div className="fixed inset-0 z-[260] bg-black/40 flex items-end lg:hidden" onClick={() => !gerando && setPreviewAberto(false)}>
          <div className="w-full h-[88vh] bg-white rounded-t-2xl flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-slate-100 shrink-0">
              <p className="font-semibold text-sci-text">Preview do relatório</p>
              <button onClick={() => setPreviewAberto(false)} className="text-sci-muted text-2xl leading-none w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100">×</button>
            </div>
            <div className="flex-1 min-h-0">
              {previewUrl ? (
                <iframe title="Preview do relatório" src={previewUrl} className="w-full h-full border-0" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-sm text-slate-400">Gerando preview...</div>
              )}
            </div>
            <div className="p-4 border-t border-slate-100 shrink-0">
              <button
                onClick={gerarPdf}
                disabled={gerando}
                className="btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {gerando ? 'Gerando...' : 'Emitir relatório em PDF'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
