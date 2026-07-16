import { createPortal } from 'react-dom'
import { unidadeDoTipo } from '../lib/formato'
import { tipoDivergente } from '../lib/conformidade'

const SITUACAO = {
  conforme:     { label: 'Conforme',     cls: 'text-green-700 bg-green-50 border-green-200' },
  nao_conforme: { label: 'Não Conforme', cls: 'text-red-700 bg-red-50 border-red-200' },
}

function formatN2(val) {
  if (!val) return null
  const [y, m] = val.split('-')
  return `${m}/${y.slice(2)}`
}

function formatN3(val) {
  if (!val) return null
  return val.split('-')[0]
}

function formatDataInsp(iso) {
  if (!iso) return null
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function Campo({ label, children }) {
  return (
    <div>
      <p className="text-[11px] text-slate-400 uppercase tracking-wide">{label}</p>
      <div className="text-sm text-slate-700">{children ?? <span className="text-slate-300">—</span>}</div>
    </div>
  )
}

export default function ModalDetalhesLocal({ local, slot, estado, onClose, tiposExtintor }) {
  const temDois = local.tem_slot_a && local.tem_slot_b
  const descSlot = local[`descricao_slot_${slot.toLowerCase()}`]
  const sit = estado.situacao_conformidade ? SITUACAO[estado.situacao_conformidade] : null
  const plantaLabel = [local.planta_tipo_exigido, local.planta_cap_ext_exigida].filter(Boolean).join(' ')

  return createPortal(
    <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md max-h-[85vh] overflow-y-auto bg-white rounded-2xl shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div className="flex items-start justify-between gap-3 p-4 border-b border-slate-100">
          <div className="flex items-center gap-2 min-w-0">
            <span className="shrink-0 text-sm font-bold text-sci-red bg-red-50 px-2.5 py-1 rounded-lg">
              {String(local.numero).padStart(2, '0')}{temDois ? slot : ''}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-800 truncate">{local.edificacao}</p>
              {(local.descricao || descSlot) && (
                <p className="text-xs text-slate-400 truncate">{[local.descricao, descSlot].filter(Boolean).join(' · ')}</p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-sci-muted text-2xl leading-none w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 shrink-0">×</button>
        </div>

        {/* Conteúdo */}
        <div className="p-4 space-y-4">

          <div className="flex items-center gap-2 flex-wrap">
            {sit && (
              <span className={`inline-block px-2 py-1 rounded-lg border text-sm font-semibold ${sit.cls}`}>
                {sit.label}
              </span>
            )}
            {tipoDivergente(estado.extintor_tipo, local.planta_tipo_exigido) && (
              <span className="inline-block px-2 py-1 rounded-lg border text-sm font-semibold text-amber-700 bg-amber-50 border-amber-200">
                Alerta
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Campo label="Planta exigida">{plantaLabel || null}</Campo>
            <Campo label="Tipo/kg atual">
              {estado.extintor_tipo ? `${estado.extintor_tipo}${estado.extintor_kg ? ` ${estado.extintor_kg}${unidadeDoTipo(estado.extintor_tipo, tiposExtintor)}` : ''}` : null}
            </Campo>
            <Campo label="Validade N2">{formatN2(estado.validade_nivel2)}</Campo>
            <Campo label="Validade N3">{formatN3(estado.validade_nivel3)}</Campo>
          </div>

          <Campo label="Não Conformidade">
            {estado.motivo_nao_conformidade}
          </Campo>

          <Campo label="Observações">
            {estado.observacoes}
          </Campo>

          <div className="flex items-center gap-2 flex-wrap">
            {estado.em_manutencao && (
              <span className="text-xs text-slate-500 bg-slate-100 border border-slate-300 px-2 py-1 rounded-lg">Em manutenção</span>
            )}
            {estado.reserva_empresa && (
              <span className="text-xs text-blue-600 bg-blue-50 border border-blue-200 px-2 py-1 rounded-lg font-semibold">RESERVA</span>
            )}
          </div>

          <div className="pt-3 border-t border-slate-100 grid grid-cols-2 gap-3">
            <Campo label="Última inspeção">{formatDataInsp(estado.data_ultima_inspecao)}</Campo>
            <Campo label="Responsável">{estado.responsavel_ultima_inspecao}</Campo>
            <Campo label="Equipe">{estado.equipe_ultima_inspecao}</Campo>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
