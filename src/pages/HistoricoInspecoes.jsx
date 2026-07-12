import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
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

function ultimoDiaDoMes(anoMes) {
  const [ano, mes] = anoMes.split('-').map(Number)
  return new Date(ano, mes, 0).getDate()
}

export default function HistoricoInspecoes() {
  const [historico, setHistorico] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtroAberto, setFiltroAberto] = useState(false)
  const [mes, setMes] = useState('')
  const [inicio, setInicio] = useState('')
  const [fim, setFim] = useState('')

  useEffect(() => {
    carregar()
    const channel = supabase
      .channel('historico-inspecoes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'historico_operacoes' }, carregar)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  function carregar() {
    fetchHistoricoInspecoes()
      .then(setHistorico)
      .catch(e => console.error(e))
      .finally(() => setLoading(false))
  }

  function aplicarMes(valor) {
    setMes(valor)
    if (valor) {
      setInicio(`${valor}-01`)
      setFim(`${valor}-${String(ultimoDiaDoMes(valor)).padStart(2, '0')}`)
    }
  }

  function limparFiltro() {
    setMes(''); setInicio(''); setFim('')
  }

  const filtroAtivo = Boolean(inicio || fim)

  const historicoFiltrado = historico.filter(item => {
    if (!inicio && !fim) return true
    const data = new Date(item.data_operacao)
    if (inicio && data < new Date(`${inicio}T00:00:00`)) return false
    if (fim && data > new Date(`${fim}T23:59:59`)) return false
    return true
  })

  if (loading) return <div className="p-4 text-sm text-slate-500">Carregando...</div>

  return (
    <div>

      {/* Barra de contagem + filtro */}
      <div className="px-3 pt-3 pb-2 flex items-center justify-between">
        <p className="text-xs text-sci-muted font-semibold uppercase tracking-wider">
          {filtroAtivo ? `${historicoFiltrado.length} de ${historico.length}` : historico.length} inspeç{(filtroAtivo ? historicoFiltrado.length : historico.length) === 1 ? 'ão' : 'ões'}
        </p>
        <button
          onClick={() => setFiltroAberto(true)}
          className="flex items-center gap-1.5 btn-option py-1.5 px-3 text-xs"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="4" y1="6" x2="20" y2="6"/>
            <line x1="8" y1="12" x2="16" y2="12"/>
            <line x1="11" y1="18" x2="13" y2="18"/>
          </svg>
          Filtros
          {filtroAtivo && (
            <span className="bg-sci-red text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center leading-none">1</span>
          )}
        </button>
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
            {historicoFiltrado.map((item, i) => {
              const local = item.locais
              const p = item.payload || {}
              const sit = SITUACAO[situacaoDoRegistro(item)]
              const rowBg = i % 2 === 0 ? 'bg-white' : 'bg-slate-50'
              return (
                <tr key={item.id} className={`${rowBg} border-b border-slate-100 hover:bg-blue-50 transition-colors`}>

                  {/* Nº */}
                  <td className={`sticky left-0 ${rowBg} px-3 py-2 z-10 font-bold text-sci-red`}>
                    {local ? String(local.numero).padStart(2, '0') : '—'}
                    {local?.tem_slot_a && local?.tem_slot_b && item.slot && (
                      <span className="text-slate-400 font-normal ml-0.5">{item.slot}</span>
                    )}
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
        {historico.length > 0 && historicoFiltrado.length === 0 && (
          <div className="text-center py-10 text-slate-400 text-sm">Nenhuma inspeção nesse período.</div>
        )}
      </div>

      {/* Bottom sheet de filtro por período */}
      {filtroAberto && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/30" onClick={() => setFiltroAberto(false)}>
          <div className="w-full bg-white rounded-t-3xl border-t border-sci-border shadow-xl p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className="font-semibold text-sci-text">Filtrar por período</p>
              <div className="flex items-center gap-3">
                {filtroAtivo && (
                  <button onClick={limparFiltro} className="text-xs text-sci-red font-medium">Limpar</button>
                )}
                <button onClick={() => setFiltroAberto(false)} className="text-sci-muted text-2xl leading-none">×</button>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-slate-400 font-medium">Mês</p>
              <input
                type="month"
                value={mes}
                onChange={e => aplicarMes(e.target.value)}
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <p className="text-xs text-slate-400 font-medium">Ou período customizado</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-slate-400">Data início</label>
                  <input
                    type="date"
                    value={inicio}
                    onChange={e => { setMes(''); setInicio(e.target.value) }}
                    className="w-full mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400">Data término</label>
                  <input
                    type="date"
                    value={fim}
                    onChange={e => { setMes(''); setFim(e.target.value) }}
                    className="w-full mt-1"
                  />
                </div>
              </div>
            </div>

            <button onClick={() => setFiltroAberto(false)} className="btn-primary w-full">Aplicar</button>
          </div>
        </div>
      )}
    </div>
  )
}
