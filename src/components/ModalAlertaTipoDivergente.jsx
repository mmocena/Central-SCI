import { textoTipoDivergente } from '../lib/conformidade'
import { trocaQueResolveComoOrigem } from '../lib/trocas'
import { SugestoesTroca } from './SugestoesTroca'

// Igual ao bloco "Tipo divergente da planta" que existia na guia Não
// Conformidades — agora vive só aqui, aberto a partir do alerta na página
// inicial, pra não confundir com as não conformidades de verdade.
export default function ModalAlertaTipoDivergente({ linhas, necessitandoKeys, onClose, onSelecionarLocal, ...trocaProps }) {
  return (
    <div className="fixed inset-0 z-[250] flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" onClick={onClose}>
      <div
        className="w-full sm:max-w-lg max-h-[85vh] bg-white rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-100 shrink-0">
          <div>
            <p className="font-semibold text-sci-text">Tipo divergente da planta</p>
            <p className="text-xs text-slate-400 mt-0.5">{linhas.length} {linhas.length === 1 ? 'extintor' : 'extintores'}</p>
          </div>
          <button onClick={onClose} className="text-sci-muted text-2xl leading-none w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 shrink-0">×</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {linhas.length === 0 ? (
            <div className="p-3 rounded-xl border border-slate-200 bg-white text-xs text-slate-400 text-center">
              Nenhum extintor nesta categoria.
            </div>
          ) : linhas.map(linha => {
            const { local, slot, estado } = linha
            const mostraSugestao = necessitandoKeys?.has(`${local.id}:${slot}`) &&
              !trocaQueResolveComoOrigem(trocaProps.trocasPlanejadas, local, slot)
            return (
              <div key={`${local.id}-${slot}`} className="rounded-2xl border border-amber-200 bg-white shadow-sm overflow-hidden">
                <button
                  onClick={() => onSelecionarLocal({ local, slot, estado })}
                  className="w-full flex items-center gap-3 p-3 text-left active:scale-[0.98] transition-transform"
                >
                  <span className="shrink-0 text-xs font-bold px-2 py-1 rounded-lg text-amber-700 bg-amber-50">
                    {String(local.numero).padStart(2, '0')}{local.tem_slot_a && local.tem_slot_b ? slot : ''}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">{local.edificacao}</p>
                    <p className="text-xs text-slate-400 truncate">
                      {textoTipoDivergente(estado.extintor_tipo, local.planta_tipo_exigido)}
                    </p>
                  </div>
                </button>
                {mostraSugestao && (
                  <div className="px-3 pb-3">
                    <SugestoesTroca linha={linha} {...trocaProps} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
