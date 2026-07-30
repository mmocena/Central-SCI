import { createPortal } from 'react-dom'

const SETORES = [
  { valor: 'EXTINTORES', label: 'Extintores' },
  { valor: 'MANGUEIRAS', label: 'Mangueiras' }
]

// Confirmação ao desmarcar "Item compartilhado" — o item vai deixar de
// aparecer no Depósito do outro setor, então pede pra escolher em qual dos
// dois ele permanece (por padrão o setor onde já está hoje).
export default function ModalEscolherSetorDeposito({ nomeItem, setorAtual, onEscolher, onCancelar }) {
  return createPortal(
    <div className="fixed inset-0 z-[260] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onCancelar}>
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-5 space-y-4" onClick={e => e.stopPropagation()}>
        <p className="font-semibold text-sci-text">Remover compartilhamento?</p>
        <p className="text-sm text-slate-500">
          <span className="font-medium text-sci-text">{nomeItem}</span> vai deixar de aparecer no Depósito do outro setor. Em qual setor ele deve permanecer?
        </p>
        <div className="grid grid-cols-2 gap-2">
          {SETORES.map(s => (
            <button
              key={s.valor}
              onClick={() => onEscolher(s.valor)}
              className={`btn-option text-sm font-semibold ${setorAtual === s.valor ? 'selected' : ''}`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <button onClick={onCancelar} className="btn-secondary w-full">Cancelar</button>
      </div>
    </div>,
    document.body
  )
}
