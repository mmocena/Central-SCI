import { useState } from 'react'
import FormInspecao from './FormInspecao'

export default function FormEnvioManutencao({
  local, slot, tiposExtintor, fatores, anosN3, equipes, onSubmit, onCancelar, bloqueado
}) {
  const [etapa, setEtapa] = useState(1) // 1 = dados do envio, 2 = inspeção do substituto
  const [envio, setEnvio] = useState({
    tipo_saiu: '',
    kg_saiu: '',
    nivel_manutencao: '',
    substituto_origem: '' // 'RESERVA' | 'SCI'
  })

  function setE(campo, valor) {
    setEnvio(f => ({ ...f, [campo]: valor }))
  }

  const tipoSaiuLabel = tiposExtintor.find(
    t => t.tipo === envio.tipo_saiu && String(t.kg) === String(envio.kg_saiu)
  )

  const etapa1Completa =
    envio.tipo_saiu && envio.kg_saiu && envio.nivel_manutencao && envio.substituto_origem

  async function handleInspecaoSubmit(dadosInspecao) {
    await onSubmit({ envio, inspecao: dadosInspecao })
  }

  if (etapa === 2) {
    const textoSubstituto = (envio.substituto_origem === 'RESERVA_DEPOSITO' || envio.substituto_origem === 'RESERVA_NOVO')
      ? <span>Extintor <span className="text-blue-600 font-semibold">RESERVA</span> — preencha os dados do substituto que ficou no local</span>
      : 'Extintor SCI — preencha os dados do substituto que ficou no local'

    return (
      <div className="space-y-3">
        {/* Botão voltar + resumo do envio */}
        <div className="space-y-2">
          <button onClick={() => setEtapa(1)} className="btn-secondary w-full text-sm">
            ← Voltar
          </button>
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-xs space-y-1">
            <p className="font-semibold text-blue-800">Extintor enviado para manutenção:</p>
            <p className="text-blue-700">
              {tipoSaiuLabel ? `${tipoSaiuLabel.tipo} ${tipoSaiuLabel.kg}kg` : '—'}
              {' · '}Nível {envio.nivel_manutencao}
              {' · '}Substituto: <strong>{{
                'SCI': 'SCI (depósito)',
                'RESERVA_DEPOSITO': <span className="text-blue-600">RESERVA do depósito</span>,
                'RESERVA_NOVO': <span className="text-blue-600">Novo RESERVA (empresa)</span>
              }[envio.substituto_origem]}</strong>
            </p>
          </div>
        </div>

        <FormInspecao
          local={local}
          slot={slot}
          estadoAtual={null}
          tiposExtintor={tiposExtintor}
          fatores={fatores}
          anosN3={anosN3}
          equipes={equipes}
          titulo={textoSubstituto}
          onSubmit={handleInspecaoSubmit}
          bloqueado={bloqueado}
          textoRegistrar="Confirmar envio e registrar substituto"
        />
      </div>
    )
  }

  return (
    <div className="card space-y-5">
      <p className="text-sm font-bold text-sci-text border-b border-sci-border pb-2">
        Envio para Manutenção
      </p>

      {/* 1. Tipo/kg que sai */}
      <div className="space-y-2">
        <p className="text-sm text-slate-700">1. Qual Tipo/kg está sendo enviado?</p>
        {tipoSaiuLabel ? (
          <div className="flex items-center gap-2">
            <span className="btn-option selected text-sm py-1.5 px-3">
              {tipoSaiuLabel.tipo} {tipoSaiuLabel.kg}kg
            </span>
            <button
              onClick={() => { setE('tipo_saiu', ''); setE('kg_saiu', '') }}
              className="text-xs text-sci-red font-medium underline"
            >
              Trocar
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {tiposExtintor.map(t => (
              <button
                key={t.id}
                onClick={() => { setE('tipo_saiu', t.tipo); setE('kg_saiu', t.kg) }}
                className="btn-option text-xs"
              >
                {t.tipo} {t.kg}kg
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 2. Nível de manutenção */}
      <div className="space-y-2">
        <p className="text-sm text-slate-700">2. Nível de manutenção:</p>
        <div className="flex gap-2">
          {['2', '3'].map(n => (
            <button
              key={n}
              onClick={() => setE('nivel_manutencao', n)}
              className={`btn-option flex-1 ${envio.nivel_manutencao === n ? 'selected' : ''}`}
            >
              Nível {n}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Origem do substituto */}
      <div className="space-y-2">
        <p className="text-sm text-slate-700">3. O substituto é:</p>
        <div className="flex flex-col gap-2">
          {[
            { valor: 'SCI', label: 'SCI (depósito)' },
            { valor: 'RESERVA_DEPOSITO', label: <><span className="text-blue-600 font-semibold">RESERVA</span> do depósito</> },
            { valor: 'RESERVA_NOVO', label: <>Novo <span className="text-blue-600 font-semibold">RESERVA</span> (empresa traz)</> },
          ].map(op => (
            <button
              key={op.valor}
              onClick={() => setE('substituto_origem', op.valor)}
              className={`btn-option w-full text-sm text-left ${envio.substituto_origem === op.valor ? 'selected' : ''}`}
            >
              {op.label}
            </button>
          ))}
        </div>

      </div>

      <div className="flex gap-2 pt-1">
        <button onClick={onCancelar} className="btn-secondary flex-1">
          Cancelar
        </button>
        <button
          onClick={() => setEtapa(2)}
          disabled={!etapa1Completa}
          className="btn-primary flex-1 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Continuar →
        </button>
      </div>
    </div>
  )
}
