import { useEffect, useState } from 'react'
import { fetchHistoricoInspecoes } from '../lib/queries'

function formatData(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit'
  })
}

export default function HistoricoInspecoes() {
  const [historico, setHistorico] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchHistoricoInspecoes()
      .then(setHistorico)
      .catch(e => console.error(e))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="p-4 text-sm text-slate-500">Carregando...</div>

  return (
    <div className="p-3 space-y-2">
      <p className="text-xs text-sci-muted font-semibold uppercase tracking-wider px-1 pb-1">
        {historico.length} inspeç{historico.length === 1 ? 'ão' : 'ões'} registrada{historico.length === 1 ? '' : 's'}
      </p>

      {historico.length === 0 && (
        <div className="text-center py-10 text-slate-400 text-sm">Nenhuma inspeção registrada ainda.</div>
      )}

      {historico.map(item => {
        const local = item.locais
        const p = item.payload || {}
        const operacional = p.operacional
        return (
          <div key={item.id} className="p-3 rounded-2xl border border-slate-200 bg-white shadow-sm space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="shrink-0 text-xs font-bold text-sci-red bg-red-50 px-2 py-1 rounded-lg">
                  {local ? String(local.numero).padStart(2, '0') : '—'}
                  {item.slot ? item.slot : ''}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-700 truncate">{local?.edificacao || 'Local removido'}</p>
                  {local?.descricao && <p className="text-xs text-slate-400 truncate">{local.descricao}</p>}
                </div>
              </div>
              <span className={`shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                operacional === false ? 'text-sci-red bg-red-50' : 'text-green-700 bg-green-50'
              }`}>
                {operacional === false ? 'Não operacional' : 'Operacional'}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
              {p.extintor_tipo && <span>{p.extintor_tipo} {p.extintor_kg ? `${p.extintor_kg}kg` : ''}</span>}
              <span>Equipe {item.equipe}</span>
              <span>{item.responsavel}</span>
              <span>{formatData(item.data_operacao)}</span>
            </div>

            {p.motivo_nao_conformidade && (
              <p className="text-xs text-sci-red">Motivo: {p.motivo_nao_conformidade}</p>
            )}
            {p.observacoes && (
              <p className="text-xs text-slate-400 italic">"{p.observacoes}"</p>
            )}
          </div>
        )
      })}
    </div>
  )
}
