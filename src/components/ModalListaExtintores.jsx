import { createPortal } from 'react-dom'

const CORES = {
  vermelho: 'text-sci-red bg-red-50',
  verde: 'text-green-700 bg-green-50',
  ambar: 'text-amber-700 bg-amber-50',
  azul: 'text-blue-700 bg-blue-50',
}

// Só a cor do texto (sem fundo), na mesma cor do badge/número — usada no
// dado específico do alerta, pra combinar com a cor do card de origem.
const CORES_TEXTO = {
  vermelho: 'text-sci-red',
  verde: 'text-green-700',
  ambar: 'text-amber-700',
  azul: 'text-blue-700',
}

function ItemExtintor({ local, slot, estado, corBadge, corTexto, onSelecionar, detalhe, onSubstituir }) {
  return (
    <div className="w-full flex items-center gap-2 p-3 rounded-2xl border border-slate-200 bg-white shadow-sm hover:bg-slate-50 transition-colors">
      <button
        onClick={() => onSelecionar({ local, slot, estado })}
        className="flex-1 min-w-0 flex items-center gap-3 text-left active:scale-[0.98] transition-transform"
      >
        <span className={`shrink-0 text-xs font-bold px-2 py-1 rounded-lg ${corBadge}`}>
          {String(local.numero).padStart(2, '0')}{local.tem_slot_a && local.tem_slot_b ? slot : ''}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-700 truncate">{local.edificacao}</p>
          {local.descricao && <p className="text-xs text-slate-400 truncate">{local.descricao}</p>}
          {detalhe && <p className={`text-xs font-medium ${corTexto}`}>{detalhe({ local, slot, estado })}</p>}
        </div>
      </button>
      {onSubstituir && (
        <button
          onClick={() => onSubstituir({ local, slot, estado })}
          className="shrink-0 text-[11px] font-semibold text-blue-600 border border-blue-300 rounded-lg px-2.5 py-1.5 hover:bg-blue-50 transition-colors"
        >
          SUBSTITUIR
        </button>
      )}
    </div>
  )
}

// grupos (opcional): [{ titulo, linhas, detalhe }] — quando presente, a lista é
// exibida em seções separadas (ex: vencimento por N2/N3) em vez de uma lista
// única. Um mesmo item pode aparecer em mais de um grupo; o contador do
// cabeçalho conta cada local+slot uma única vez. `detalhe` (opcional, no modo
// flat ou por grupo) é uma função (row) => texto, exibida abaixo da descrição
// do local — ex: o motivo específico do alerta.
export default function ModalListaExtintores({ titulo, linhas, grupos, onClose, onSelecionar, cor = 'vermelho', detalhe, onSubstituir }) {
  const corBadge = CORES[cor] || CORES.vermelho
  const corTexto = CORES_TEXTO[cor] || CORES_TEXTO.vermelho

  const totalUnico = grupos
    ? new Set(grupos.flatMap(g => g.linhas).map(({ local, slot }) => `${local.id}-${slot}`)).size
    : linhas.length

  return createPortal(
    <div className="fixed inset-0 z-[240] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="w-full max-w-md max-h-[85vh] flex flex-col bg-white rounded-2xl shadow-xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <p className="font-semibold text-sci-text">
            {titulo} <span className="text-slate-400 font-normal">({totalUnico})</span>
          </p>
          <button onClick={onClose} className="text-sci-muted text-2xl leading-none w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 shrink-0">×</button>
        </div>

        <div className="overflow-y-auto p-3 space-y-2">
          {grupos ? (
            totalUnico === 0 ? (
              <div className="text-center py-8 text-slate-400 text-sm">Nenhum extintor encontrado.</div>
            ) : grupos.map(g => (
              <div key={g.titulo} className="space-y-2">
                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide px-1 pt-1">
                  {g.titulo} <span className="font-normal normal-case">({g.linhas.length})</span>
                </p>
                {g.linhas.length === 0 ? (
                  <div className="text-center py-3 text-slate-300 text-xs">Nenhum.</div>
                ) : g.linhas.map(({ local, slot, estado }) => (
                  <ItemExtintor key={`${local.id}-${slot}`} local={local} slot={slot} estado={estado} corBadge={corBadge} corTexto={corTexto} onSelecionar={onSelecionar} detalhe={g.detalhe} onSubstituir={onSubstituir} />
                ))}
              </div>
            ))
          ) : linhas.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm">Nenhum extintor encontrado.</div>
          ) : linhas.map(({ local, slot, estado }) => (
            <ItemExtintor key={`${local.id}-${slot}`} local={local} slot={slot} estado={estado} corBadge={corBadge} corTexto={corTexto} onSelecionar={onSelecionar} detalhe={detalhe} onSubstituir={onSubstituir} />
          ))}
        </div>
      </div>
    </div>,
    document.body
  )
}
