import { useEffect, useState } from 'react'
import { fetchHistoricoInspecoes } from '../lib/queries'
import { calcularConformidade } from '../lib/conformidade'

const SITUACAO = {
  conforme:     { label: 'Conforme',     cls: 'text-green-700 bg-green-50 border-green-200' },
  alerta:       { label: 'Alerta',       cls: 'text-amber-700 bg-amber-50 border-amber-200' },
  nao_conforme: { label: 'Não Conforme', cls: 'text-red-700 bg-red-50 border-red-200' },
}

const COR_TIPO = {
  'co²':     'text-amber-700 bg-amber-50',
  'pqs bc':  'text-teal-700 bg-teal-50',
  'pqs abc': 'text-violet-700 bg-violet-50',
  'água':    'text-fuchsia-700 bg-fuchsia-50',
}

// Registros antigos não têm a conformidade salva no payload — recalcula com os dados do local atual.
function situacaoDoRegistro(item) {
  const p = item.payload || {}
  const local = item.locais
  if (p.conformidade) return p.conformidade
  return calcularConformidade({
    capExtAtual: p.cap_ext_atual,
    capExtExigida: local?.planta_cap_ext_exigida,
    tipoAtual: p.extintor_tipo,
    tipoExigido: local?.planta_tipo_exigido,
    capExtOk: local?.planta_cap_ext_exigida ? p.cap_ext_ok : undefined,
    operacional: p.operacional,
    sinalizacaoOk: p.sinalizacao_ok
  })
}

function corTipo(tipo) {
  return tipo ? (COR_TIPO[tipo.toLowerCase()] ?? 'text-slate-700 bg-sci-red') : ''
}

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
    <div>

      {/* Barra de contagem */}
      <div className="px-3 pt-3 pb-2">
        <p className="text-xs text-sci-muted font-semibold uppercase tracking-wider">
          {historico.length} inspeç{historico.length === 1 ? 'ão' : 'ões'}
        </p>
      </div>

      {/* Tabela */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse" style={{ minWidth: 720 }}>
          <thead className="sticky top-0 z-30">
            <tr className="bg-sci-red text-white font-semibold uppercase tracking-wide whitespace-nowrap">
              <th className="sticky left-0 bg-sci-red text-left px-3 py-2 border-b border-slate-200 z-[31] w-10">Nº</th>
              <th className="bg-sci-red text-left px-3 py-2 border-b border-slate-200 min-w-[160px]">Local</th>
              <th className="bg-sci-red text-center px-3 py-2 border-b border-slate-200">Tipo/kg</th>
              <th className="bg-sci-red text-center px-3 py-2 border-b border-slate-200">Situação</th>
              <th className="bg-sci-red text-center px-3 py-2 border-b border-slate-200">Não Conformidade</th>
              <th className="bg-sci-red text-center px-3 py-2 border-b border-slate-200 min-w-[160px]">Observações</th>
              <th className="bg-sci-red text-center px-3 py-2 border-b border-slate-200">Equipe</th>
              <th className="bg-sci-red text-center px-3 py-2 border-b border-slate-200">Responsável</th>
              <th className="bg-sci-red text-center px-3 py-2 border-b border-slate-200">Data</th>
            </tr>
          </thead>
          <tbody>
            {historico.map((item, i) => {
              const local = item.locais
              const p = item.payload || {}
              const sit = SITUACAO[situacaoDoRegistro(item)]
              const rowBg = i % 2 === 0 ? 'bg-white' : 'bg-slate-50'
              return (
                <tr key={item.id} className={`${rowBg} border-b border-slate-100 hover:bg-blue-50 transition-colors`}>

                  {/* Nº */}
                  <td className={`sticky left-0 ${rowBg} px-3 py-2 z-10 font-bold text-sci-red`}>
                    {local ? String(local.numero).padStart(2, '0') : '—'}
                    {item.slot && <span className="text-slate-400 font-normal ml-0.5">{item.slot}</span>}
                  </td>

                  {/* Local */}
                  <td className="px-3 py-2">
                    <p className="font-medium text-slate-700 leading-tight">{local?.edificacao || 'Local removido'}</p>
                    {local?.descricao && (
                      <p className="text-slate-400 leading-tight">{local.descricao}</p>
                    )}
                  </td>

                  {/* Tipo/kg */}
                  <td className="px-3 py-2 text-center">
                    {p.extintor_tipo ? (
                      <span className={`inline-flex flex-col items-center px-2 py-0.5 rounded font-medium leading-tight ${corTipo(p.extintor_tipo)}`}>
                        <span className="whitespace-nowrap">{p.extintor_tipo}</span>
                        {p.extintor_kg && <span className="whitespace-nowrap">{p.extintor_kg}kg</span>}
                      </span>
                    ) : <span className="text-slate-300 italic">—</span>}
                  </td>

                  {/* Situação */}
                  <td className="px-3 py-2 text-center whitespace-nowrap">
                    {sit ? (
                      <span className={`px-1.5 rounded border font-medium ${sit.cls}`}>
                        {sit.label}
                      </span>
                    ) : <span className="text-slate-300">—</span>}
                  </td>

                  {/* Não Conformidade */}
                  <td className="px-3 py-2 text-xs text-red-500 text-center">
                    {p.motivo_nao_conformidade || <span className="text-slate-300">—</span>}
                  </td>

                  {/* Observações */}
                  <td className="px-3 py-2 text-xs text-slate-500 text-center">
                    {p.observacoes || <span className="text-slate-300">—</span>}
                  </td>

                  {/* Equipe */}
                  <td className="px-3 py-2 text-center text-slate-600">
                    {item.equipe}
                  </td>

                  {/* Responsável */}
                  <td className="px-3 py-2 text-center text-slate-600">
                    {item.responsavel}
                  </td>

                  {/* Data */}
                  <td className="px-3 py-2 text-center text-slate-600 whitespace-nowrap">
                    {formatData(item.data_operacao)}
                  </td>

                </tr>
              )
            })}
          </tbody>
        </table>

        {historico.length === 0 && (
          <div className="text-center py-10 text-slate-400 text-sm">Nenhuma inspeção registrada ainda.</div>
        )}
      </div>
    </div>
  )
}
