import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import FormInspecao from './FormInspecao'

export default function FormRetornoManutencao({
  local, slot, estadoSlot, tiposExtintor, fatores, anosN3, equipes, bloqueado, onSubmit, onCancelar
}) {
  const [ordem, setOrdem] = useState(null)
  const [destino, setDestino] = useState(null) // 'LOCAL' | 'ESTOQUE'

  useEffect(() => {
    if (!estadoSlot?.ordem_manutencao_id) return
    supabase
      .from('ordens_manutencao')
      .select('*')
      .eq('id', estadoSlot.ordem_manutencao_id)
      .single()
      .then(({ data }) => setOrdem(data))
  }, [estadoSlot?.ordem_manutencao_id])

  if (!ordem) {
    return (
      <div className="card text-sm text-slate-500 text-center py-6">
        Carregando dados da manutenção...
      </div>
    )
  }

  const tituloInspecao = destino === 'LOCAL'
    ? `Inspecione o extintor que retornou (${ordem.extintor_saiu_tipo} ${ordem.extintor_saiu_kg}kg)`
    : `Inspecione o substituto que permanece no local (${ordem.substituto_tipo} ${ordem.substituto_kg}kg)`

  return (
    <div className="space-y-3">
      <button onClick={onCancelar} className="btn-secondary w-full text-sm">
        ← Voltar
      </button>

      {/* Resumo da ordem */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs space-y-1.5">
        <p className="font-semibold text-slate-700">Em manutenção:</p>
        <p className="text-slate-600">
          {ordem.extintor_saiu_tipo} {ordem.extintor_saiu_kg}kg · Nível {ordem.nivel_manutencao}
        </p>
        <p className="font-semibold text-slate-700 pt-1">Substituto atual no local:</p>
        <p className="text-slate-600">
          {ordem.substituto_tipo} {ordem.substituto_kg}kg
          {' · '}
          <span className={ordem.substituto_reserva ? 'text-blue-600 font-medium' : ''}>
            {ordem.substituto_reserva ? 'RESERVA (empresa)' : 'Estoque SCI'}
          </span>
        </p>
      </div>

      {/* Destino do extintor que retornou */}
      {!destino && (
        <div className="card space-y-3">
          <p className="text-sm font-semibold text-sci-text">
            O extintor ({ordem.extintor_saiu_tipo} {ordem.extintor_saiu_kg}kg) retornou para:
          </p>
          <div className="flex gap-2">
            <button onClick={() => setDestino('LOCAL')} className="btn-option flex-1 text-sm">
              Este local
            </button>
            <button onClick={() => setDestino('ESTOQUE')} className="btn-option flex-1 text-sm">
              Estoque SCI
            </button>
          </div>
        </div>
      )}

      {/* Destino selecionado + troca */}
      {destino && (
        <div className="flex items-center gap-2">
          <span className="btn-option selected text-sm py-1.5 px-3">
            {destino === 'LOCAL' ? 'Retornou para este local' : 'Foi para o Estoque SCI'}
          </span>
          <button
            onClick={() => setDestino(null)}
            className="text-xs text-sci-red font-medium underline"
          >
            Trocar
          </button>
        </div>
      )}

      {/* Formulário de inspeção do extintor que fica no local */}
      {destino && (
        <FormInspecao
          local={local}
          slot={slot}
          estadoAtual={estadoSlot}
          tiposExtintor={tiposExtintor}
          fatores={fatores}
          anosN3={anosN3}
          equipes={equipes}
          titulo={tituloInspecao}
          bloqueado={bloqueado}
          textoRegistrar="Confirmar retorno e registrar inspeção"
          onSubmit={(dadosInspecao) => onSubmit({ destino, ordem, inspecao: dadosInspecao })}
        />
      )}
    </div>
  )
}
