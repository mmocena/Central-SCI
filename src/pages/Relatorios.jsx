import { useEffect, useState } from 'react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import {
  fetchLocaisComEstado, fetchLocaisComVencimento, fetchInicioPeriodoInspecao, fetchHistoricoInspecoes
} from '../lib/queries'
import { calcularConformidade } from '../lib/conformidade'
import { useToast } from '../components/Toast'

const SITUACAO_LABEL = { conforme: 'Conforme', alerta: 'Alerta', nao_conforme: 'Não Conforme' }

function ultimoDiaDoMes(anoMes) {
  const [ano, mes] = anoMes.split('-').map(Number)
  return new Date(ano, mes, 0).getDate()
}

function situacaoDoRegistroHistorico(item) {
  const p = item.payload || {}
  const local = item.locais
  if (p.conformidade) return p.conformidade
  return calcularConformidade({
    capExtAtual: p.cap_ext_atual,
    capExtExigida: local?.planta_cap_ext_exigida,
    tipoAtual: p.extintor_tipo,
    tipoExigido: local?.planta_tipo_exigido,
    capExtOk: local?.planta_cap_ext_exigida ? p.cap_ext_ok : undefined,
    operacional: p.operacional,
    sinalizacaoOk: p.sinalizacao_ok
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

// Mesmas cores usadas nas telas de Situação/Histórico (Tailwind -600/-50),
// convertidas pra RGB porque o autoTable não entende classes CSS.
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

// Decide a cor de uma célula do corpo da tabela a partir da coluna (key) e
// do texto exibido — reproduz no PDF as mesmas etiquetas coloridas do app.
function estiloCelulaPdf(colKey, valor) {
  if (colKey === 'situacao') return COR_SITUACAO_PDF[valor] || null
  if (colKey === 'tipo_kg') return COR_TIPO_PDF.find(t => t.teste.test(valor)) || null
  if (colKey === 'nao_conformidade' && valor && valor !== '—') return { text: [185, 28, 28] }
  if (colKey === 'status') {
    if (/RESERVA/.test(valor)) return { text: [37, 99, 235], fill: [239, 246, 255] }
    if (/Manutenção/.test(valor)) return { text: [100, 116, 139], fill: [241, 245, 249] }
  }
  return null
}

function didParseCellComCores(colunas) {
  return data => {
    if (data.section !== 'body') return
    const coluna = colunas[data.column.index]
    if (!coluna) return
    const estilo = estiloCelulaPdf(coluna.key, String(data.cell.raw))
    if (!estilo) return
    if (estilo.text) data.cell.styles.textColor = estilo.text
    if (estilo.fill) data.cell.styles.fillColor = estilo.fill
    if (coluna.key === 'situacao') data.cell.styles.fontStyle = 'bold'
  }
}

// Grade compacta de chips selecionáveis — usada tanto pros indicadores
// quanto pra escolha de colunas, evitando uma lista longa de uma linha
// por item (o que deixava a tela muito extensa).
function SeletorChips({ itens, ativos, onToggle }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {itens.map(item => {
        const sel = ativos.has(item.key)
        return (
          <button
            key={item.key}
            onClick={() => onToggle(item.key)}
            className={`text-xs px-2.5 py-1.5 rounded-full border font-medium transition-colors ${
              sel ? 'bg-sci-red text-white border-sci-red' : 'bg-white text-slate-500 border-slate-200'
            }`}
          >
            {item.label}{item.valor !== undefined ? ` · ${item.valor}` : ''}
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

// Definição das colunas disponíveis por tabela — cada uma sabe extrair seu
// próprio valor da linha, usado tanto na UI de seleção quanto no PDF.
const COLUNAS_SITUACAO = [
  { key: 'numero', label: 'Nº', get: ({ local, slot }) => String(local.numero).padStart(2, '0') + (local.tem_slot_a && local.tem_slot_b ? slot : '') },
  { key: 'local', label: 'Local', get: ({ local }) => local.edificacao },
  { key: 'planta', label: 'Planta', get: ({ local }) => [local.planta_tipo_exigido, local.planta_cap_ext_exigida].filter(Boolean).join(' ') || '—' },
  { key: 'tipo_kg', label: 'Tipo/kg', get: ({ estado }) => estado.extintor_tipo ? `${estado.extintor_tipo} ${estado.extintor_kg || ''}kg` : '—' },
  { key: 'validade_n2', label: 'Val. N2', get: ({ estado }) => formatN2(estado.validade_nivel2) },
  { key: 'validade_n3', label: 'Val. N3', get: ({ estado }) => formatN3(estado.validade_nivel3) },
  { key: 'situacao', label: 'Situação', get: ({ estado }) => estado.situacao_conformidade ? SITUACAO_LABEL[estado.situacao_conformidade] : '—' },
  { key: 'nao_conformidade', label: 'Não Conformidade', get: ({ estado }) => estado.motivo_nao_conformidade || '—' },
  { key: 'observacoes', label: 'Observações', get: ({ estado }) => estado.observacoes || '—' },
  { key: 'status', label: 'Status', get: ({ estado }) => [estado.em_manutencao && 'Manutenção', estado.reserva_empresa && 'RESERVA'].filter(Boolean).join(', ') || '—' },
  { key: 'data', label: 'Última Inspeção', get: ({ estado }) => formatDataHora(estado.data_ultima_inspecao) },
]

const COLUNAS_HISTORICO = [
  {
    key: 'numero', label: 'Nº', get: item => {
      if (!item.locais) return '—'
      const temDoisSlots = item.locais.tem_slot_a && item.locais.tem_slot_b
      return String(item.locais.numero).padStart(2, '0') + (temDoisSlots ? item.slot : '')
    }
  },
  { key: 'local', label: 'Local', get: item => item.locais?.edificacao || 'Local removido' },
  { key: 'tipo_kg', label: 'Tipo/kg', get: item => item.payload?.extintor_tipo ? `${item.payload.extintor_tipo} ${item.payload.extintor_kg || ''}kg` : '—' },
  { key: 'situacao', label: 'Situação', get: item => SITUACAO_LABEL[situacaoDoRegistroHistorico(item)] || '—' },
  { key: 'nao_conformidade', label: 'Não Conformidade', get: item => item.payload?.motivo_nao_conformidade || '—' },
  { key: 'observacoes', label: 'Observações', get: item => item.payload?.observacoes || '—' },
  { key: 'equipe', label: 'Equipe', get: item => item.equipe },
  { key: 'responsavel', label: 'Responsável', get: item => item.responsavel },
  { key: 'data', label: 'Data', get: item => formatDataHora(item.data_operacao) },
]

export default function Relatorios() {
  const showToast = useToast()
  const [locais, setLocais] = useState([])
  const [vencimentos, setVencimentos] = useState([])
  const [inicioPeriodo, setInicioPeriodo] = useState(null)
  const [historico, setHistorico] = useState([])
  const [loading, setLoading] = useState(true)
  const [gerando, setGerando] = useState(false)

  const [titulo, setTitulo] = useState('Relatório de Extintores')
  const [subtitulo, setSubtitulo] = useState('')
  const [orientacao, setOrientacao] = useState('retrato')
  const [modoLista, setModoLista] = useState('situacao')
  const [mes, setMes] = useState('')
  const [inicioFiltro, setInicioFiltro] = useState('')
  const [fimFiltro, setFimFiltro] = useState('')
  const [observacoes, setObservacoes] = useState('')

  useEffect(() => {
    Promise.all([
      fetchLocaisComEstado(),
      fetchLocaisComVencimento(),
      fetchInicioPeriodoInspecao(),
      fetchHistoricoInspecoes()
    ]).then(([locaisData, vencData, periodo, historicoData]) => {
      setLocais(locaisData)
      setVencimentos(vencData)
      setInicioPeriodo(periodo)
      setHistorico(historicoData)
    }).catch(e => console.error(e))
      .finally(() => setLoading(false))
  }, [])

  const linhas = locais.flatMap(local => {
    const slots = local.local_estado_atual || []
    return ['A', 'B']
      .filter(slot => slot === 'A' ? local.tem_slot_a : local.tem_slot_b)
      .map(slot => ({ local, slot, estado: slots.find(s => s.slot === slot) || {} }))
  })

  const linhasVistoriadas = linhas.filter(l =>
    l.estado.data_ultima_inspecao && (!inicioPeriodo || l.estado.data_ultima_inspecao >= inicioPeriodo)
  )
  const linhasConforme = linhas.filter(l => l.estado.situacao_conformidade === 'conforme')
  const linhasAlerta = linhas.filter(l => l.estado.situacao_conformidade === 'alerta')
  const linhasNaoConforme = linhas.filter(l => l.estado.situacao_conformidade === 'nao_conforme')
  const linhasReserva = linhas.filter(l => l.estado.reserva_empresa)
  const linhasVencendo = vencimentos.flatMap(v =>
    v.vencimentos.map(venc => linhas.find(l => l.local.id === v.id && l.slot === venc.slot)).filter(Boolean)
  )

  const CARDS = [
    { key: 'total', label: 'Total de extintores', valor: linhas.length },
    { key: 'vistoriados', label: 'Vistoriados', valor: linhasVistoriadas.length },
    { key: 'sem_inspecao', label: 'Sem inspeção', valor: linhas.length - linhasVistoriadas.length },
    { key: 'em_manutencao', label: 'Em manutenção', valor: linhas.filter(l => l.estado.em_manutencao).length },
    { key: 'conforme', label: 'Conforme', valor: linhasConforme.length },
    { key: 'alerta', label: 'Alerta', valor: linhasAlerta.length },
    { key: 'nao_conforme', label: 'Não conforme', valor: linhasNaoConforme.length },
    { key: 'reserva', label: 'RESERVA em campo', valor: linhasReserva.length },
    { key: 'vencendo', label: 'Vencendo este ano', valor: linhasVencendo.length },
  ]

  const [cardsAtivos, setCardsAtivos] = useState(() => new Set(CARDS.map(c => c.key)))
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

  function gerarPdf() {
    setGerando(true)
    try {
      const doc = new jsPDF({ orientation: orientacao === 'paisagem' ? 'landscape' : 'portrait' })
      const margem = 14
      const larguraUtil = doc.internal.pageSize.getWidth() - margem * 2
      const alturaPagina = doc.internal.pageSize.getHeight()
      let y = 18

      doc.setFontSize(18)
      doc.setTextColor(20)
      doc.text(titulo || 'Relatório', margem, y)
      y += 8

      if (subtitulo.trim()) {
        doc.setFontSize(11)
        doc.setTextColor(90)
        doc.text(subtitulo, margem, y)
        y += 7
      }

      doc.setFontSize(9)
      doc.setTextColor(140)
      doc.text(`Emitido em ${new Date().toLocaleString('pt-BR')}`, margem, y)
      y += 10
      doc.setTextColor(20)

      const cardsSelecionados = CARDS.filter(c => cardsAtivos.has(c.key))
      if (cardsSelecionados.length) {
        doc.setFontSize(13)
        doc.text('Resumo', margem, y)
        y += 4
        autoTable(doc, {
          startY: y,
          head: [['Indicador', 'Valor']],
          body: cardsSelecionados.map(c => [c.label, String(c.valor)]),
          theme: 'grid',
          headStyles: { fillColor: [220, 38, 38] },
          margin: { left: margem, right: margem },
          styles: { fontSize: 9 }
        })
        y = doc.lastAutoTable.finalY + 10
      }

      if (modoLista === 'situacao') {
        const colunas = COLUNAS_SITUACAO.filter(c => colunasSituacaoAtivas.has(c.key))
        doc.setFontSize(13)
        doc.text('Situação atual', margem, y)
        y += 4
        autoTable(doc, {
          startY: y,
          head: [colunas.map(c => c.label)],
          body: linhas.map(linha => colunas.map(c => c.get(linha))),
          theme: 'grid',
          headStyles: { fillColor: [220, 38, 38] },
          margin: { left: margem, right: margem },
          styles: { fontSize: 8 },
          didParseCell: didParseCellComCores(colunas)
        })
        y = doc.lastAutoTable.finalY + 10
      } else {
        const colunas = COLUNAS_HISTORICO.filter(c => colunasHistoricoAtivas.has(c.key))
        doc.setFontSize(13)
        doc.text('Histórico de inspeções' + (inicioFiltro || fimFiltro ? ' (período filtrado)' : ''), margem, y)
        y += 4
        autoTable(doc, {
          startY: y,
          head: [colunas.map(c => c.label)],
          body: historicoFiltrado.map(item => colunas.map(c => c.get(item))),
          theme: 'grid',
          headStyles: { fillColor: [220, 38, 38] },
          margin: { left: margem, right: margem },
          didParseCell: didParseCellComCores(colunas),
          styles: { fontSize: 8 }
        })
        y = doc.lastAutoTable.finalY + 10
      }

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

      const nomeArquivo = (titulo || 'relatorio').toLowerCase().trim()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'relatorio'
      doc.save(`${nomeArquivo}.pdf`)
      showToast('Relatório emitido com sucesso.')
    } catch (e) {
      showToast('Erro ao gerar PDF: ' + e.message, 'erro')
    } finally {
      setGerando(false)
    }
  }

  if (loading) return <div className="p-4 text-sm text-slate-500">Carregando...</div>

  return (
    <div className="p-4 space-y-5">

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
              onClick={() => setOrientacao('retrato')}
              className={`btn-option flex-1 text-sm ${orientacao === 'retrato' ? 'selected' : ''}`}
            >
              Retrato
            </button>
            <button
              onClick={() => setOrientacao('paisagem')}
              className={`btn-option flex-1 text-sm ${orientacao === 'paisagem' ? 'selected' : ''}`}
            >
              Paisagem
            </button>
          </div>
        </div>
      </div>

      {/* Cards do dashboard */}
      <div className="space-y-2">
        <CabecalhoSelecao
          titulo="Indicadores"
          total={CARDS.length}
          ativos={cardsAtivos.size}
          onTodos={() => setCardsAtivos(new Set(CARDS.map(c => c.key)))}
          onNenhum={() => setCardsAtivos(new Set())}
        />
        <SeletorChips itens={CARDS} ativos={cardsAtivos} onToggle={key => alternarNoSet(setCardsAtivos, key)} />
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
          const colunas = modoLista === 'situacao' ? COLUNAS_SITUACAO : COLUNAS_HISTORICO
          const ativas = modoLista === 'situacao' ? colunasSituacaoAtivas : colunasHistoricoAtivas
          const setAtivas = modoLista === 'situacao' ? setColunasSituacaoAtivas : setColunasHistoricoAtivas
          return (
            <div className="space-y-2 pt-1">
              <CabecalhoSelecao
                titulo="Colunas da tabela"
                total={colunas.length}
                ativos={ativas.size}
                onTodos={() => setAtivas(new Set(colunas.map(c => c.key)))}
                onNenhum={() => setAtivas(new Set())}
              />
              <SeletorChips itens={colunas} ativos={ativas} onToggle={key => alternarNoSet(setAtivas, key)} />
            </div>
          )
        })()}
      </div>

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

      <button
        onClick={gerarPdf}
        disabled={gerando}
        className="btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {gerando ? 'Gerando...' : 'Emitir relatório em PDF'}
      </button>
    </div>
  )
}
