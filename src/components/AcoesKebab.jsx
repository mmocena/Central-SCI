import { useState } from 'react'

// Ícones padrão por label conhecido — mesmo estilo (stroke, sem fill) dos
// ícones já usados no Header. Mantém as opções alinhadas em coluna mesmo
// quando misturadas com itens de checkbox (mesma largura de slot pros dois).
const ICONE_PADRAO = {
  Editar: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  ),
  Excluir: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    </svg>
  ),
  Arquivar: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="4" rx="1" />
      <path d="M5 8v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8" />
      <path d="M10 13h4" />
    </svg>
  ),
  Restaurar: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
    </svg>
  ),
  Gerenciar: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="18" x2="20" y2="18" />
      <circle cx="9" cy="6" r="2" fill="white" />
      <circle cx="16" cy="12" r="2" fill="white" />
      <circle cx="9" cy="18" r="2" fill="white" />
    </svg>
  ),
}

// Kebab genérico por linha de lista — reaproveitável em qualquer tela que
// precise de um menu de ações (Editar/Excluir/Arquivar/...) ancorado a um
// item específico, sem precisar de um botão de texto solto por ação.
// acoes: [{ label, onClick, destrutivo?, checked?, info? }] — quando
// `checked` está presente (true ou false), a ação vira um item com checkbox
// em vez de ícone (ex: "Item compartilhado"); nesse caso só o próprio
// checkbox aciona onClick (o label é só texto, não clicável, pra evitar
// toggle sem querer ao ler a explicação). `info` (texto) adiciona um botão
// "i" que mostra uma explicação sem acionar onClick.
export default function AcoesKebab({ acoes }) {
  const [aberto, setAberto] = useState(false)
  const [infoAberto, setInfoAberto] = useState(null)

  function fechar() {
    setAberto(false)
    setInfoAberto(null)
  }

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
          <div className="fixed inset-0 z-40" onClick={fechar} />
          <div className="absolute right-0 top-8 z-50 bg-white border border-slate-200 rounded-xl shadow-lg py-1 min-w-max">
            {acoes.map(a => {
              const isCheckbox = a.checked !== undefined
              return (
                <div key={a.label}>
                  <div
                    onClick={isCheckbox ? undefined : () => { setAberto(false); a.onClick() }}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm whitespace-nowrap transition-colors ${isCheckbox ? '' : 'cursor-pointer hover:bg-slate-50'} ${a.destrutivo ? 'text-sci-red' : 'text-slate-700'}`}
                  >
                    {isCheckbox ? (
                      <button
                        onClick={a.onClick}
                        aria-label={a.label}
                        className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 text-[10px] leading-none transition-colors ${a.checked ? 'bg-sci-red border-sci-red text-white' : 'border-slate-300 hover:border-slate-400'}`}
                      >
                        {a.checked ? '✓' : ''}
                      </button>
                    ) : (
                      <span className="w-4 h-4 shrink-0">
                        {ICONE_PADRAO[a.label] || null}
                      </span>
                    )}
                    <span className="flex-1">{a.label}</span>
                    {a.info && (
                      <span
                        onClick={e => { e.stopPropagation(); setInfoAberto(v => v === a.label ? null : a.label) }}
                        aria-label={`O que é ${a.label}?`}
                        className="shrink-0 w-4 h-4 rounded-full border border-slate-300 text-slate-400 text-[10px] font-bold flex items-center justify-center hover:border-slate-400 hover:text-slate-500"
                      >
                        i
                      </span>
                    )}
                  </div>
                  {a.info && infoAberto === a.label && (
                    <p className="px-3 pb-2 text-xs text-slate-500 leading-snug max-w-[220px]">{a.info}</p>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
