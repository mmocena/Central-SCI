import { createPortal } from 'react-dom'

// Modal de confirmação genérico — mesmo padrão visual já usado em
// src/pages/Deposito.jsx (confirmExcluir), extraído aqui pra reaproveitar
// em qualquer tela que precise confirmar uma ação antes de executá-la.
export default function ModalConfirmar({ titulo, mensagem, textoConfirmar = 'Confirmar', onConfirmar, onCancelar }) {
  return createPortal(
    <div className="fixed inset-0 z-[260] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onCancelar}>
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-5 space-y-4" onClick={e => e.stopPropagation()}>
        <p className="font-semibold text-sci-text">{titulo}</p>
        <p className="text-sm text-slate-500">{mensagem}</p>
        <div className="flex gap-2">
          <button onClick={onCancelar} className="btn-secondary flex-1">Cancelar</button>
          <button onClick={onConfirmar} className="btn-primary flex-1">{textoConfirmar}</button>
        </div>
      </div>
    </div>,
    document.body
  )
}
