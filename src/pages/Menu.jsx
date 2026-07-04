import { useNavigate } from 'react-router-dom'

const CARDS = [
  {
    to: '/inspecao',
    titulo: 'Inspeção',
    descricao: 'Registre inspeções por ponto de instalação e acompanhe a conformidade dos extintores.',
    abas: null,
    destaque: true,
    icon: (
      <svg width="22" height="22" viewBox="0 0 512 512" fill="#dc2626" xmlns="http://www.w3.org/2000/svg">
        <path d="M455.133,34.678l-5.496-0.756l5.496-0.756c9.115-1.254,15.487-9.66,14.233-18.775c-1.254-9.115-9.659-15.489-18.774-14.233L334.864,16.084c-0.308-8.931-7.624-16.082-16.63-16.082c-9.2,0-16.659,7.459-16.659,16.659v0.601h-61.168c-24.728,0-46.662,13.895-57.354,35.459l-4.376-1.735c-7.99-3.169-17.078,0.261-20.983,7.919L44.294,281.31c-2.13,4.178-2.401,9.062-0.744,13.45s5.086,7.874,9.445,9.604l80.223,31.813c1.976,0.784,4.059,1.173,6.141,1.173c2.51,0,5.017-0.568,7.32-1.694c4.213-2.06,7.362-5.802,8.675-10.304l69.839-239.679c2.404-8.252-1.864-16.978-9.853-20.147l-1.064-0.422c5.504-8.908,15.25-14.521,26.132-14.521h61.168v24.163c-42.97,6.753-75.945,44.025-75.945,88.862v331.735c0,9.2,7.459,16.659,16.659,16.659h151.889c9.2,0,16.659-7.459,16.659-16.659V163.606c0-44.837-32.974-82.11-75.944-88.862v-22.98l115.698,15.922c0.771,0.107,1.536,0.158,2.292,0.158c8.192,0,15.334-6.046,16.483-14.39C470.62,44.339,464.249,35.933,455.133,34.678z M128.486,298.456l-46.194-18.319l98.198-192.59l8.472,3.36L128.486,298.456z M377.519,478.681h-118.57v-25.366h118.57V478.681z M377.519,163.606v256.392h-118.57V163.606c0-31.233,25.409-56.642,56.642-56.642h5.287C352.109,106.964,377.519,132.373,377.519,163.606z"/>
      </svg>
    ),
  },
  {
    to: '/manutencoes',
    titulo: 'Manutenções',
    descricao: 'Gerencie o ciclo completo de manutenção dos extintores.',
    abas: ['Envio', 'Recebimento', 'Substituir RESERVAS'],
    destaque: false,
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/>
      </svg>
    ),
  },
  {
    to: '/deposito',
    titulo: 'Depósito',
    descricao: 'Controle o estoque de extintores SCI e RESERVA disponíveis para substituição.',
    abas: null,
    destaque: false,
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 8h14M5 8a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v0a2 2 0 01-2 2M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8"/>
        <line x1="10" y1="12" x2="14" y2="12"/>
      </svg>
    ),
  },
  {
    to: '/situacao',
    titulo: 'Situação',
    descricao: 'Visualize o status de conformidade de todos os extintores em uma tabela.',
    abas: null,
    destaque: false,
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
        <rect x="9" y="3" width="6" height="4" rx="1"/>
        <line x1="9" y1="12" x2="15" y2="12"/>
        <line x1="9" y1="16" x2="13" y2="16"/>
      </svg>
    ),
  },
  {
    to: '/admin',
    titulo: 'Configurações',
    descricao: 'Gerencie os locais cadastrados e configurações do sistema.',
    abas: null,
    destaque: false,
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
      </svg>
    ),
  },
]

export default function Menu() {
  const navigate = useNavigate()

  return (
    <div className="h-full p-4 grid grid-cols-1 grid-rows-5 gap-3">
      {CARDS.map(card => (
        <button
          key={card.to}
          onClick={() => navigate(card.to)}
          className={`flex items-start gap-3 p-4 rounded-2xl border shadow-sm text-left active:scale-[0.98] transition-transform ${
            card.destaque
              ? 'bg-red-50 border-red-200 hover:bg-red-100'
              : 'bg-white border-slate-200 hover:shadow-md'
          }`}
        >
          <div className="shrink-0 mt-0.5">{card.icon}</div>
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-bold leading-tight mb-0.5 ${card.destaque ? 'text-sci-red' : 'text-sci-text'}`}>
              {card.titulo}
            </p>
            <p className="text-xs text-slate-500 leading-snug">
              {card.descricao}
            </p>
            {card.abas && (
              <div className="flex gap-2 flex-wrap mt-1.5">
                {card.abas.map(aba => (
                  <span key={aba} className="text-[10px] font-medium text-slate-400 flex items-center gap-1">
                    <span className="w-1 h-1 rounded-full bg-slate-300 shrink-0" />
                    {aba}
                  </span>
                ))}
              </div>
            )}
          </div>
        </button>
      ))}
    </div>
  )
}
