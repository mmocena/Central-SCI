import { useState } from 'react'
import { verificarSenhaAdmin } from '../lib/queries'

// Mesma senha/sessão pra todas as áreas administrativas do app (Admin de
// Extintores, cadastro de Mangueiras etc.) — quem já autenticou numa não
// precisa logar de novo na outra.
export const SESSION_KEY = 'sci_config_auth'

export default function TelaLoginAdmin() {
  const [valor, setValor] = useState('')
  const [erro, setErro] = useState(false)
  const [carregando, setCarregando] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setCarregando(true)
    const ok = await verificarSenhaAdmin(valor)
    setCarregando(false)
    if (ok) {
      sessionStorage.setItem(SESSION_KEY, '1')
      window.location.reload()
    } else {
      setErro(true)
      setValor('')
    }
  }

  return (
    <div className="flex flex-col items-center justify-center h-full px-8 gap-6">
      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-700 to-slate-500 flex items-center justify-center shadow">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
          <path d="M7 11V7a5 5 0 0110 0v4"/>
        </svg>
      </div>
      <div className="text-center">
        <p className="text-sm font-bold text-sci-text">Configurações</p>
        <p className="text-xs text-slate-400 mt-0.5">Acesso restrito</p>
      </div>
      <form onSubmit={handleSubmit} className="w-full space-y-3">
        <input
          type="password"
          value={valor}
          onChange={e => { setValor(e.target.value); setErro(false) }}
          placeholder="Senha"
          autoFocus
          className={`w-full border rounded-xl px-4 py-3 text-sm outline-none transition-colors ${
            erro ? 'border-red-400 bg-red-50 placeholder-red-300' : 'border-slate-200 bg-white focus:border-slate-400'
          }`}
        />
        {erro && <p className="text-xs text-red-500 text-center">Senha incorreta.</p>}
        <button
          type="submit"
          disabled={!valor || carregando}
          className="btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {carregando ? 'Verificando...' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}
