import { createPortal } from 'react-dom'

// Wrapper de modal genérico pra formulários (título + botão fechar +
// conteúdo rolável) — mesmo padrão visual (createPortal, rounded-2xl,
// shadow-xl, backdrop-blur) já usado nos demais modais do app.
export default function ModalFormulario({ titulo, onFechar, children }) {
  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onFechar}>
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-5 space-y-3 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-sci-text">{titulo}</p>
          <button onClick={onFechar} className="text-slate-400 text-xl leading-none w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 shrink-0">×</button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  )
}
