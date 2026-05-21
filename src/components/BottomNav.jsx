import { NavLink } from 'react-router-dom'
import IconeExtintor from './IconeExtintor'

const ACTIVE = '#374151'
const INACTIVE = '#94a3b8'

function IconeManutencoes({ color }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/>
    </svg>
  )
}

function IconeSituacao({ color }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
      <rect x="9" y="3" width="6" height="4" rx="1"/>
      <line x1="9" y1="12" x2="15" y2="12"/>
      <line x1="9" y1="16" x2="13" y2="16"/>
    </svg>
  )
}

function IconeAdmin({ color }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
    </svg>
  )
}

const tabs = [
  { to: '/', label: 'Extintores',   Icon: ({ color }) => <IconeExtintor size={22} color={color} /> },
  { to: '/manutencoes', label: 'Manutenções', Icon: IconeManutencoes },
  { to: '/situacao',    label: 'Situação',    Icon: IconeSituacao },
  { to: '/admin',       label: 'Admin',       Icon: IconeAdmin },
]

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-sm border-t border-slate-200 flex z-10 shadow-[0_-1px_4px_rgba(0,0,0,0.06)] pb-3">
      {tabs.map(({ to, label, Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className="flex-1 flex flex-col items-center pt-2 gap-0.5 text-xs transition-colors"
        >
          {({ isActive }) => (
            <>
              <Icon color={isActive ? ACTIVE : INACTIVE} />
              <span className={`font-medium text-[10px] ${isActive ? 'text-slate-600' : 'text-slate-400'}`}>{label}</span>
              <span className={`w-1.5 h-1.5 rounded-full mt-0.5 transition-all ${isActive ? 'bg-sci-red' : 'bg-transparent'}`} />
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
