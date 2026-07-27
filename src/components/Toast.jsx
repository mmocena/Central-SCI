import { createContext, useCallback, useContext, useState } from 'react'
import { createPortal } from 'react-dom'

const ToastContext = createContext(null)

const ESTILOS = {
  sucesso: 'bg-green-600',
  erro: 'bg-sci-red',
  aviso: 'bg-amber-500',
}

let idCounter = 0

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const showToast = useCallback((mensagem, tipo = 'sucesso') => {
    const id = ++idCounter
    setToasts(t => [...t, { id, mensagem, tipo }])
    setTimeout(() => {
      setToasts(t => t.filter(x => x.id !== id))
    }, 4000)
  }, [])

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      {createPortal(
        <div className="fixed bottom-6 left-0 right-0 z-[300] flex flex-col items-center gap-2 px-4 pointer-events-none">
          {toasts.map(t => (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-center gap-2 text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-lg ${ESTILOS[t.tipo] || ESTILOS.sucesso}`}
            >
              {t.mensagem}
            </div>
          ))}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  )
}

// showToast(mensagem, 'sucesso' | 'erro' | 'aviso')
export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast deve ser usado dentro de ToastProvider')
  return ctx
}

// Usado após qualquer chamada que passa pela fila offline
// (executarOuEnfileirar): mesma mensagem de sucesso se aplicou na hora, ou
// aviso de fila se ficou pendente por falta de conexão.
export function avisarResultado(showToast, resultado, msgSucesso) {
  showToast(
    resultado.queued ? 'Sem conexão — será enviado automaticamente ao reconectar.' : msgSucesso,
    resultado.queued ? 'aviso' : 'sucesso'
  )
}
