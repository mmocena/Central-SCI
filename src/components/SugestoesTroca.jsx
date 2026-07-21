import { useState } from 'react'
import { createPortal } from 'react-dom'
import { candidatosParaLocal, trocaPlanejadaDoLocal, trocaQueResolveComoOrigem } from '../lib/trocas'

function labelCandidatoTopo(c) {
  if (c.tipo !== 'local') return null
  return (
    <span className="inline-flex items-center gap-1 align-middle">
      <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
        {String(c.local.numero).padStart(2, '0')}
      </span>
      <span className="text-[11px] text-slate-600"><strong className="font-semibold">{c.local.edificacao}</strong> -</span>
    </span>
  )
}

function labelCandidatoResto(c) {
  if (c.tipo === 'local') {
    return <>tem {c.tipoOferecido} no lugar de {c.local.planta_tipo_exigido}.</>
  }
  if (c.tipo === 'estoque_reserva') {
    return <>Estoque <span className="text-blue-600 font-medium">RESERVA</span> — {c.estoque.tipo} {c.estoque.kg}kg</>
  }
  return <>Estoque SCI — {c.estoque.tipo} {c.estoque.kg}kg</>
}

function labelTrocaEscolhida(troca) {
  if (troca.origem_tipo === 'local') {
    const l = troca.origem_local
    return l ? `Local #${String(l.numero).padStart(2, '0')} — ${l.edificacao}` : 'Local removido'
  }
  const e = troca.origem_estoque
  if (troca.origem_tipo === 'estoque_reserva') {
    return <>Estoque <span className="text-blue-600 font-medium">RESERVA</span>{e ? ` — ${e.tipo} ${e.kg}kg` : ''}</>
  }
  return e ? `Estoque SCI — ${e.tipo} ${e.kg}kg` : 'Estoque SCI'
}

export function ModalInfoTrocas({ onClose }) {
  return createPortal(
    <div className="fixed inset-0 z-[260] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm max-h-[85vh] overflow-y-auto bg-white rounded-2xl shadow-xl p-5 space-y-3"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <p className="font-semibold text-sci-text">Sugestões de troca</p>
          <button onClick={onClose} className="text-sci-muted text-2xl leading-none w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 shrink-0">×</button>
        </div>

        <p className="text-sm text-slate-600 leading-relaxed">
          Quando um extintor tem o <strong>Tipo</strong> errado (ex: PQS BC no lugar de PQS ABC), às vezes dá pra
          resolver com os extintores já disponíveis só trocando com outro local que tenha o tipo certo sobrando, ou
          usando uma unidade disponível no Depósito.
        </p>

        <p className="text-sm text-slate-600 leading-relaxed">
          O sistema sugere de onde esse tipo poderia vir, em ordem de prioridade: primeiro uma <strong>troca recíproca</strong> com
          outro local (que também precisa do que você tem — os dois se resolvem juntos), depois estoque <strong>SCI</strong>, depois
          estoque <strong className="text-blue-600">RESERVA (empresa)</strong>, se houver. A primeira opção listada é a recomendada.
        </p>

        <p className="text-sm text-slate-600 leading-relaxed">
          A sugestão considera só o <strong>Tipo</strong> — sempre confira se a capacidade extintora do candidato também atende
          antes de trocar de verdade.
        </p>

        <p className="text-sm text-slate-600 leading-relaxed">
          Clicar em <strong>Definir</strong> só marca um plano (visível pra todo mundo, em qualquer aparelho) — não troca nada
          sozinho. Depois de fazer a troca física em campo, é preciso registrar uma nova inspeção nos locais envolvidos pra
          atualizar o sistema; o plano some automaticamente quando isso acontece. Pra desistir antes disso, use <strong>Desfazer</strong>.
        </p>
      </div>
    </div>,
    document.body
  )
}

// Sugestões de troca de Tipo pra sanar a necessidade de um local — só
// aparece pra quem está em `necessitando` (capacidade insuficiente por
// tipo errado, ou alerta de tipo divergente puro). É só sugestão: definir
// uma opção só marca um plano, não executa a troca sozinho — depois de
// trocar fisicamente, é preciso registrar uma inspeção nova pra valer.
// Compartilhado entre a guia Não Conformidades (bloco Capacidade extintora)
// e o modal de alerta "Tipo divergente da planta" na página inicial.
export function SugestoesTroca({ linha, todasLinhas, estoqueSCI, estoqueRESERVA, trocasPlanejadas, responsavel, processando, onDefinir, onCancelar }) {
  const [infoAberto, setInfoAberto] = useState(false)
  const trocaAtual = trocaPlanejadaDoLocal(trocasPlanejadas, linha.local, linha.slot)

  if (trocaAtual) {
    const desfazendo = processando === trocaAtual.id
    return (
      <div className="mt-1.5 flex items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
        <span className="text-xs text-slate-600">
          Troca definida: <strong className="text-slate-700">{labelTrocaEscolhida(trocaAtual)}</strong>
        </span>
        <button
          onClick={() => onCancelar(trocaAtual.id)}
          disabled={desfazendo}
          className="text-xs text-sci-red font-medium shrink-0 disabled:opacity-40"
        >
          {desfazendo ? 'Desfazendo...' : 'Desfazer'}
        </button>
      </div>
    )
  }

  // Troca recíproca resolve os dois lados de uma vez — se este local já é a
  // origem do plano de outro destino, a necessidade dele já está coberta ali.
  // Não mostra nada aqui (nem sugestões, nem aviso) — evita definir a mesma
  // troca 2x sem poluir a tela; desfazer continua disponível pelo card do
  // outro local (o destino).
  const trocaComoOrigem = trocaQueResolveComoOrigem(trocasPlanejadas, linha.local, linha.slot)
  if (trocaComoOrigem) return null

  const candidatos = candidatosParaLocal({ necessitando: linha, linhas: todasLinhas, estoqueSCI, estoqueRESERVA, trocasPlanejadas })

  if (candidatos.length === 0) {
    return (
      <p className="mt-1.5 text-xs text-slate-400 italic">Sem opção de troca disponível no momento.</p>
    )
  }

  const definindo = processando === `${linha.local.id}:${linha.slot}`

  return (
    <div className="mt-1.5 space-y-1">
      <div className="flex items-center gap-1">
        <p className="text-[11px] text-slate-400">Sugestões de troca — verifique se a capacidade atende:</p>
        <button
          onClick={() => setInfoAberto(true)}
          aria-label="O que são sugestões de troca?"
          className="shrink-0 w-4 h-4 rounded-full border border-slate-300 text-slate-400 text-[10px] font-bold flex items-center justify-center hover:border-slate-400 hover:text-slate-500"
        >
          i
        </button>
      </div>
      {candidatos.map((c, i) => (
        <button
          key={c.tipo === 'local' ? `local-${c.local.id}-${c.slot}` : `estoque-${c.estoque.id}`}
          onClick={() => onDefinir(linha, c, responsavel)}
          disabled={definindo}
          className="w-full flex items-center justify-between gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2 text-left hover:border-slate-300 transition-colors disabled:opacity-40"
        >
          <span className="min-w-0">
            {(i === 0 || c.tipo === 'local') && (
              <p className="flex items-center gap-1.5 flex-wrap">
                {labelCandidatoTopo(c)}
                {i === 0 && <span className="text-[10px] font-bold text-green-600">RECOMENDADO</span>}
              </p>
            )}
            <p className="text-xs text-slate-600">{labelCandidatoResto(c)}</p>
          </span>
          <span className="text-xs font-medium text-sci-red shrink-0">{definindo ? 'Definindo...' : 'Definir'}</span>
        </button>
      ))}
      {infoAberto && <ModalInfoTrocas onClose={() => setInfoAberto(false)} />}
    </div>
  )
}
