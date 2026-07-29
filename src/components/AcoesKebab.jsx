import { useState } from 'react'

// Kebab genérico por linha de lista — reaproveitável em qualquer tela que
// precise de um menu de ações (Editar/Excluir/Arquivar/...) ancorado a um
// item específico, sem precisar de um botão de texto solto por ação.
// acoes: [{ label, onClick, destrutivo? }]
export default function AcoesKebab({ acoes }) {
  const [aberto, setAberto] = useState(false)

  return (
    <div className="relative shrink-0">
      <button
        onClick={() => setAberto(v => !v)}
        className="w-7 h-7 flex flex-col items-center justify-center gap-[3px] rounded-lg hover:bg-slate-100 transition-colors"
        aria-label="Ações"
      >
        <span className="w-1 h-1 rounded-full bg-slate-400" />
        <span className="w-1 h-1 rounded-full bg-slate-400" />
        <span className="w-1 h-1 rounded-full bg-slate-400" />
      </button>

      {aberto && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setAberto(false)} />
          <div className="absolute right-0 top-8 z-50 bg-white border border-slate-200 rounded-xl shadow-lg py-1 min-w-[140px]">
            {acoes.map(a => (
              <button
                key={a.label}
                onClick={() => { setAberto(false); a.onClick() }}
                className={`w-full text-left px-3 py-2 text-sm transition-colors hover:bg-slate-50 ${a.destrutivo ? 'text-sci-red' : 'text-slate-700'}`}
              >
                {a.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
