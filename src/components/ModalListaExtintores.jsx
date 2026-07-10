import { createPortal } from 'react-dom'

const CORES = {
  vermelho: 'text-sci-red bg-red-50',
  verde: 'text-green-700 bg-green-50',
  ambar: 'text-amber-700 bg-amber-50',
  azul: 'text-blue-700 bg-blue-50',
}

export default function ModalListaExtintores({ titulo, linhas, onClose, onSelecionar, cor = 'vermelho' }) {
  const corBadge = CORES[cor] || CORES.vermelho

  return createPortal(
    <div className="fixed inset-0 z-[240] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md max-h-[85vh] flex flex-col bg-white rounded-2xl shadow-xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <p className="font-semibold text-sci-text">
            {titulo} <span className="text-slate-400 font-normal">({linhas.length})</span>
          </p>
          <button onClick={onClose} className="text-sci-muted text-2xl leading-none w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 shrink-0">×</button>
        </div>

        <div className="overflow-y-auto p-3 space-y-2">
          {linhas.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm">Nenhum extintor encontrado.</div>
          ) : linhas.map(({ local, slot, estado }) => (
            <button
              key={`${local.id}-${slot}`}
              onClick={() => onSelecionar({ local, slot, estado })}
              className="w-full flex items-center gap-3 p-3 rounded-2xl border border-slate-200 bg-white shadow-sm text-left active:scale-[0.98] transition-transform hover:bg-slate-50"
            >
              <span className={`shrink-0 text-xs font-bold px-2 py-1 rounded-lg ${corBadge}`}>
                {String(local.numero).padStart(2, '0')}{local.tem_slot_a && local.tem_slot_b ? slot : ''}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-700 truncate">{local.edificacao}</p>
                {local.descricao && <p className="text-xs text-slate-400 truncate">{local.descricao}</p>}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body
  )
}
