import { unidadeDoTipo } from '../lib/formato'
import { tipoDivergente } from '../lib/conformidade'

const SITUACAO = {
  conforme:     { label: 'Conforme',     cls: 'text-green-700 bg-green-50 border-green-200' },
  nao_conforme: { label: 'Não Conforme', cls: 'text-red-700 bg-red-50 border-red-200' },
}

const COR_TIPO = {
  'co²':     'text-amber-700 bg-amber-50',
  'pqs bc':  'text-teal-700 bg-teal-50',
  'pqs abc': 'text-violet-700 bg-violet-50',
  'água':    'text-fuchsia-700 bg-fuchsia-50',
}

function corTipo(tipo) {
  return tipo ? (COR_TIPO[tipo.toLowerCase()] ?? 'text-slate-700 bg-sci-red') : ''
}

function formatN2(val) {
  if (!val) return null
  // val = 'YYYY-MM-DD'
  const [y, m] = val.split('-')
  return `${m}/${y.slice(2)}`
}

function formatN3(val) {
  if (!val) return null
  return val.split('-')[0] // just the year
}

function validadeClasse(dateStr) {
  if (!dateStr) return 'text-slate-300'
  const d = new Date(dateStr)
  const hoje = new Date()
  const diffMs = d - hoje
  const diffDias = diffMs / (1000 * 60 * 60 * 24)
  if (diffDias < 0) return 'text-red-600 font-semibold'
  if (diffDias < 90) return 'text-amber-600 font-semibold'
  return 'text-slate-600'
}

function formatDataInsp(iso) {
  if (!iso) return null
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

// Tabela de situação atual — mesma tabela usada na guia Situação e embutida
// no Dashboard. Espera uma linha por slot: { local, slot, temDois, descSlot, estado }.
export default function TabelaSituacao({ linhas, tiposExtintor }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse" style={{ minWidth: 900 }}>
        <thead className="sticky top-0 z-30">
          <tr className="bg-sci-red text-white font-semibold uppercase tracking-wide whitespace-nowrap">
            <th className="sticky left-0 bg-sci-red text-left px-3 py-2 border-b border-slate-200 z-[31] w-10">Nº</th>
            <th className="bg-sci-red text-left px-3 py-2 border-b border-slate-200 min-w-[160px]">Local</th>
            <th className="bg-sci-red text-center px-3 py-2 border-b border-slate-200">Planta</th>
            <th className="bg-sci-red text-center px-3 py-2 border-b border-slate-200">Tipo/kg</th>
            <th className="bg-sci-red text-center px-3 py-2 border-b border-slate-200">Situação</th>
            <th className="bg-sci-red text-center px-3 py-2 border-b border-slate-200">Não Conformidade</th>
            <th className="bg-sci-red text-center px-3 py-2 border-b border-slate-200 min-w-[160px]">Observações</th>
            <th className="bg-sci-red text-center px-3 py-2 border-b border-slate-200">Val. N2</th>
            <th className="bg-sci-red text-center px-3 py-2 border-b border-slate-200">Val. N3</th>
            <th className="bg-sci-red text-center px-3 py-2 border-b border-slate-200">Status</th>
            <th className="bg-sci-red text-center px-3 py-2 border-b border-slate-200">Equipe</th>
            <th className="bg-sci-red text-center px-3 py-2 border-b border-slate-200">Responsável</th>
            <th className="bg-sci-red text-center px-3 py-2 border-b border-slate-200">Data/Hora</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map(({ local, slot, temDois, descSlot, estado }, i) => {
            const sit = estado.situacao_conformidade ? SITUACAO[estado.situacao_conformidade] : null
            const rowBg = i % 2 === 0 ? 'bg-white' : 'bg-slate-50'
            return (
              <tr key={`${local.id}-${slot}`} className={`${rowBg} border-b border-slate-100 hover:bg-blue-50 transition-colors`}>

                {/* Nº */}
                <td className={`sticky left-0 ${rowBg} px-3 py-2 z-10 font-bold text-sci-red`}>
                  {String(local.numero).padStart(2, '0')}
                  {temDois && <span className="text-slate-400 font-normal ml-0.5">{slot}</span>}
                </td>

                {/* Local */}
                <td className="px-3 py-2">
                  <p className="font-medium text-slate-700 leading-tight">{local.edificacao}</p>
                  {(local.descricao || descSlot) && (
                    <p className="text-slate-400 leading-tight">
                      {[local.descricao, descSlot].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </td>

                {/* Planta */}
                <td className="px-3 py-2 text-center">
                  {(local.planta_tipo_exigido || local.planta_cap_ext_exigida) ? (
                    <span className={`inline-flex flex-col items-center px-2 py-0.5 rounded font-medium leading-tight ${corTipo(local.planta_tipo_exigido)}`}>
                      {local.planta_tipo_exigido && <span className="whitespace-nowrap">{local.planta_tipo_exigido}</span>}
                      {local.planta_cap_ext_exigida && <span className="whitespace-nowrap">{local.planta_cap_ext_exigida}</span>}
                    </span>
                  ) : <span className="text-slate-300">—</span>}
                </td>

                {/* Tipo/kg */}
                <td className="px-3 py-2 text-center">
                  {estado.extintor_tipo ? (
                    <span className={`inline-flex flex-col items-center px-2 py-0.5 rounded font-medium leading-tight ${corTipo(estado.extintor_tipo)}`}>
                      <span className="whitespace-nowrap">{estado.extintor_tipo}</span>
                      {estado.extintor_kg && <span className="whitespace-nowrap">{estado.extintor_kg}{unidadeDoTipo(estado.extintor_tipo, tiposExtintor)}</span>}
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
                  {estado.motivo_nao_conformidade || <span className="text-slate-300">—</span>}
                </td>

                {/* Observações */}
                <td className="px-3 py-2 text-xs text-slate-500 text-center">
                  {estado.observacoes || <span className="text-slate-300">—</span>}
                </td>

                {/* Val. N2 */}
                <td className={`px-3 py-2 text-center ${validadeClasse(estado.validade_nivel2)}`}>
                  {formatN2(estado.validade_nivel2) || <span className="text-slate-300">—</span>}
                </td>

                {/* Val. N3 */}
                <td className={`px-3 py-2 text-center ${validadeClasse(estado.validade_nivel3)}`}>
                  {formatN3(estado.validade_nivel3) || <span className="text-slate-300">—</span>}
                </td>

                {/* Status */}
                <td className="px-3 py-2 text-center">
                  <div className="flex items-center justify-center gap-1 flex-wrap">
                    {tipoDivergente(estado.extintor_tipo, local.planta_tipo_exigido) && (
                      <span className="text-amber-700 bg-amber-50 border border-amber-200 px-1.5 rounded">Alerta</span>
                    )}
                    {estado.reserva_empresa && (
                      <span className="text-blue-600 bg-blue-50 border border-blue-200 px-1.5 rounded">RESERVA</span>
                    )}
                  </div>
                </td>

                {/* Equipe */}
                <td className="px-3 py-2 text-center text-slate-600">
                  {estado.equipe_ultima_inspecao || <span className="text-slate-300">—</span>}
                </td>

                {/* Responsável */}
                <td className="px-3 py-2 text-center text-slate-600">
                  {estado.responsavel_ultima_inspecao || <span className="text-slate-300">—</span>}
                </td>

                {/* Data/Hora */}
                <td className="px-3 py-2 text-center text-slate-600 whitespace-nowrap">
                  {formatDataInsp(estado.data_ultima_inspecao) || <span className="text-slate-300 italic">Não inspecionado</span>}
                </td>

              </tr>
            )
          })}
        </tbody>
      </table>

      {linhas.length === 0 && (
        <div className="text-center py-10 text-slate-400 text-sm">Nenhum extintor encontrado.</div>
      )}
    </div>
  )
}
