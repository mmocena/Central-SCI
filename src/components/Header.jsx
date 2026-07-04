import { useState } from 'react'
import { NavLink, Link } from 'react-router-dom'

const MENU_ITEMS = [
  {
    to: '/menu',
    label: 'Menu',
    icon: (active) => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? '#dc2626' : '#64748b'} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <line x1="4" y1="6" x2="20" y2="6"/>
        <line x1="4" y1="12" x2="20" y2="12"/>
        <line x1="4" y1="18" x2="20" y2="18"/>
      </svg>
    ),
  },
  {
    to: '/inspecao',
    label: 'Inspeção',
    icon: (active) => (
      <svg width="18" height="18" viewBox="0 0 512 512" fill={active ? '#dc2626' : '#64748b'} xmlns="http://www.w3.org/2000/svg">
        <path d="M455.133,34.678l-5.496-0.756l5.496-0.756c9.115-1.254,15.487-9.66,14.233-18.775c-1.254-9.115-9.659-15.489-18.774-14.233L334.864,16.084c-0.308-8.931-7.624-16.082-16.63-16.082c-9.2,0-16.659,7.459-16.659,16.659v0.601h-61.168c-24.728,0-46.662,13.895-57.354,35.459l-4.376-1.735c-7.99-3.169-17.078,0.261-20.983,7.919L44.294,281.31c-2.13,4.178-2.401,9.062-0.744,13.45s5.086,7.874,9.445,9.604l80.223,31.813c1.976,0.784,4.059,1.173,6.141,1.173c2.51,0,5.017-0.568,7.32-1.694c4.213-2.06,7.362-5.802,8.675-10.304l69.839-239.679c2.404-8.252-1.864-16.978-9.853-20.147l-1.064-0.422c5.504-8.908,15.25-14.521,26.132-14.521h61.168v24.163c-42.97,6.753-75.945,44.025-75.945,88.862v331.735c0,9.2,7.459,16.659,16.659,16.659h151.889c9.2,0,16.659-7.459,16.659-16.659V163.606c0-44.837-32.974-82.11-75.944-88.862v-22.98l115.698,15.922c0.771,0.107,1.536,0.158,2.292,0.158c8.192,0,15.334-6.046,16.483-14.39C470.62,44.339,464.249,35.933,455.133,34.678z M128.486,298.456l-46.194-18.319l98.198-192.59l8.472,3.36L128.486,298.456z M377.519,478.681h-118.57v-25.366h118.57V478.681z M377.519,163.606v256.392h-118.57V163.606c0-31.233,25.409-56.642,56.642-56.642h5.287C352.109,106.964,377.519,132.373,377.519,163.606z"/>
      </svg>
    ),
  },
  {
    to: '/manutencoes',
    label: 'Manutenções',
    icon: (active) => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? '#dc2626' : '#64748b'} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/>
      </svg>
    ),
  },
  {
    to: '/deposito',
    label: 'Depósito',
    icon: (active) => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? '#dc2626' : '#64748b'} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 8h14M5 8a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v0a2 2 0 01-2 2M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8"/>
        <line x1="10" y1="12" x2="14" y2="12"/>
      </svg>
    ),
  },
  {
    to: '/situacao',
    label: 'Situação',
    icon: (active) => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? '#dc2626' : '#64748b'} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
        <rect x="9" y="3" width="6" height="4" rx="1"/>
        <line x1="9" y1="12" x2="15" y2="12"/>
        <line x1="9" y1="16" x2="13" y2="16"/>
      </svg>
    ),
  },
  {
    to: '/historico',
    label: 'Histórico de Inspeções',
    icon: (active) => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? '#dc2626' : '#64748b'} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9"/>
        <polyline points="12 7 12 12 15.5 14"/>
      </svg>
    ),
  },
  {
    to: '/admin',
    label: 'Configurações',
    icon: (active) => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? '#dc2626' : '#64748b'} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
      </svg>
    ),
  },
]

export default function Header() {
  const [aberto, setAberto] = useState(false)

  return (
    <>
      <header className="bg-white/80 backdrop-blur-sm border-b border-slate-200 px-4 py-3 flex items-center gap-3 sticky top-0 z-40 shadow-sm">
        <Link to="/" className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-red-600 to-red-400 flex items-center justify-center shrink-0 shadow-sm">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2C11 4.5 8.5 7.5 8.5 11c0 .6.1 1.2.3 1.7C8 11.8 7.5 10.6 7.5 9.5c-1.5 2-2.5 4-2.5 6a7 7 0 0014 0c0-5.5-4-10-7-13zm0 17a4 4 0 01-4-4c0-1.5.7-2.8 1.5-3.8.2.8.7 1.5 1.5 1.8-.2-.5-.3-1-.3-1.5 0-1.2.5-2.5 1.3-3.5 1 1.5 2 3.5 2 5a2 2 0 01-2 2 2 2 0 01-2-2c0-.5.2-1 .5-1.4-.1.4-.2.9-.2 1.4a2 2 0 104 0c0-1.2-.5-2.5-1-3.5.5 1 1 2.2 1 3.5a4 4 0 01-4 4z" />
            </svg>
          </div>
          <div>
            <h1 className="text-sm font-bold text-sci-text leading-none">Central SCI</h1>
            <p className="text-xs text-sci-muted leading-none mt-0.5">Controle de extintores</p>
          </div>
        </Link>

        {/* Kebab menu button */}
        <button
          onClick={() => setAberto(o => !o)}
          className="w-9 h-9 flex flex-col items-center justify-center gap-[5px] rounded-lg hover:bg-slate-100 transition-colors shrink-0"
          aria-label="Menu"
        >
          <span className="w-1 h-1 rounded-full bg-slate-500" />
          <span className="w-1 h-1 rounded-full bg-slate-500" />
          <span className="w-1 h-1 rounded-full bg-slate-500" />
        </button>
      </header>

      {/* Overlay */}
      {aberto && (
        <div className="fixed inset-0 z-40" onClick={() => setAberto(false)} />
      )}

      {/* Dropdown */}
      {aberto && (
        <div className="fixed top-[64px] right-3 z-50 bg-white border border-slate-200 rounded-2xl shadow-lg py-1.5 min-w-[180px]">
          {MENU_ITEMS.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/inspecao'}
              onClick={() => setAberto(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                  isActive ? 'text-sci-red font-semibold bg-red-50' : 'text-slate-600 hover:bg-slate-50'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {icon(isActive)}
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      )}
    </>
  )
}
