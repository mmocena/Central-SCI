import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { fetchTiposExtintor, fetchFatoresNaoOperacionalidade, registrarInspecao, registrarEnvioManutencao, marcarReserva } from '../lib/queries'
import { calcularConformidade } from '../lib/conformidade'
import IconeExtintor from './IconeExtintor'
import FormInspecao from './FormInspecao'
import FormEnvioManutencao from './FormEnvioManutencao'

const ANO_ATUAL = new Date().getFullYear()
const ANOS_N3 = [ANO_ATUAL - 1, ...Array.from({ length: 6 }, (_, i) => ANO_ATUAL + i)]
const EQUIPES = ['ALFA', 'BRAVO', 'CHARLIE', 'DELTA']

export default function ModalLocal({ local, responsavel, onClose, onAtualizar, substituicaoAtiva = false, envioPreAberto = false }) {
  const [tiposExtintor, setTiposExtintor] = useState([])
  const [fatores, setFatores] = useState([])
  const [modoManutencao, setModoManutencao] = useState(envioPreAberto ? 'envio' : null)
  const [reservaAtiva, setReservaAtiva] = useState(false)
  const [avisoReserva, setAvisoReserva] = useState(false)
  const [modoSubstituicao, setModoSubstituicao] = useState(substituicaoAtiva)
  const [slotAtivo, setSlotAtivo] = useState(local.tem_slot_a ? 'A' : 'B')

  const temDoisSlots = local.tem_slot_a && local.tem_slot_b

  useEffect(() => {
    fetchTiposExtintor().then(setTiposExtintor)
    fetchFatoresNaoOperacionalidade().then(setFatores)
  }, [])

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const main = document.querySelector('main')
    if (main) main.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
      if (main) main.style.overflow = ''
    }
  }, [])

  const slots = local.local_estado_atual || []
  const estadoSlot = slots.find(s => s.slot === slotAtivo)
  const isReserva = reservaAtiva || estadoSlot?.reserva_empresa

  async function handleRegistrarInspecao(dados) {
    if (!responsavel) { alert('Informe seu nome antes de registrar.'); return }

    if (dados.isDual) {
      const conf = (slotData) => calcularConformidade({
        capExtOk: local.planta_cap_ext_exigida ? slotData.cap_ext_ok : undefined,
        capExtExigida: local.planta_cap_ext_exigida,
        tipoAtual: slotData.extintor_tipo,
        tipoExigido: local.planta_tipo_exigido,
        operacional: slotData.operacional,
        sinalizacaoOk: slotData.sinalizacao_ok
      })
      await Promise.all([
        registrarInspecao({ localId: local.id, slot: 'A', responsavel, equipe: dados.slotA.equipe, payload: dados.slotA, conformidade: conf(dados.slotA) }),
        registrarInspecao({ localId: local.id, slot: 'B', responsavel, equipe: dados.slotB.equipe, payload: dados.slotB, conformidade: conf(dados.slotB) })
      ])
    } else {
      const conformidade = calcularConformidade({
        capExtOk: local.planta_cap_ext_exigida ? dados.cap_ext_ok : undefined,
        capExtExigida: local.planta_cap_ext_exigida,
        tipoAtual: dados.extintor_tipo,
        tipoExigido: local.planta_tipo_exigido,
        operacional: dados.operacional,
        sinalizacaoOk: dados.sinalizacao_ok
      })
      await registrarInspecao({
        localId: local.id,
        slot: slotAtivo,
        responsavel,
        equipe: dados.equipe,
        payload: dados,
        conformidade
      })
    }
    if (modoSubstituicao) {
      await marcarReserva({ localId: local.id, slot: slotAtivo, valor: false })
    }
    onAtualizar()
    onClose()
  }

  const plantaLabel = [local.planta_tipo_exigido, local.planta_cap_ext_exigida].filter(Boolean).join(' ')

  return createPortal(
    <div className="fixed inset-0 z-[200] overflow-y-auto bg-slate-100">

      {/* Cabeçalho */}
      <div className="sticky top-0 bg-white/80 backdrop-blur-sm border-b border-slate-200 shadow-sm z-10 flex items-stretch">

        {/* Coluna esquerda — ícone + número vermelhos + separador */}
        <div className="flex items-center justify-center px-4 gap-2 shrink-0">
          <IconeExtintor size={26} color="#dc2626" />
          <span className="text-sci-red font-bold text-xl leading-none">
            {String(local.numero).padStart(2, '0')}
          </span>
        </div>
        <div className="w-px bg-slate-200 my-3 shrink-0" />

        {/* Conteúdo */}
        <div className="flex-1 min-w-0 p-3 space-y-1">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-0.5 min-w-0">
              {plantaLabel && (
                <div className="flex items-center gap-1">
                  <span className="text-xs text-slate-400">Planta:</span>
                  <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">{plantaLabel}</span>
                </div>
              )}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-semibold text-sm text-slate-800">{local.edificacao}</span>
                {local.descricao && (
                  <span className="text-xs text-slate-400">{local.descricao}</span>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-sci-muted text-2xl leading-none w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 shrink-0"
            >
              ×
            </button>
          </div>

          {/* Seletor de slot — só para manutenção */}
          {temDoisSlots && modoManutencao === 'envio' && (
            <div className="flex gap-2 pt-1">
              <p className="text-xs text-slate-500 self-center shrink-0">Enviando:</p>
              {['A', 'B'].map(slot => {
                const desc = local[`descricao_slot_${slot.toLowerCase()}`]
                return (
                  <button
                    key={slot}
                    onClick={() => setSlotAtivo(slot)}
                    className={`btn-option flex-1 py-1.5 text-sm ${slotAtivo === slot ? 'selected' : ''}`}
                  >
                    Extintor {slot}{desc ? ` (${desc})` : ''}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Conteúdo rolável */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {/* Aviso — em manutenção com RESERVA como substituto */}
        {!modoManutencao && estadoSlot?.em_manutencao && estadoSlot?.reserva_empresa && (
          <div className="bg-slate-100 border border-slate-300 rounded-xl px-4 py-3 text-xs text-slate-600">
            O extintor foi enviado para manutenção e tem um <strong className="text-blue-600">RESERVA</strong> como substituto.
            Registre o recebimento na aba <strong>Manutenções</strong> e substitua o extintor <span className="text-blue-600 font-semibold">RESERVA</span> posteriormente.
          </div>
        )}

        {/* Botão de envio para manutenção — só aparece se o slot não estiver já em manutenção e não tiver sido pré-aberto */}
        {!modoManutencao && !estadoSlot?.em_manutencao && !envioPreAberto && (
          <button
            onClick={() => setModoManutencao('envio')}
            className="w-full border border-dashed border-slate-300 bg-white rounded-xl py-3 text-sm text-slate-500 text-center hover:border-slate-400 transition-colors"
          >
            Envio para manutenção? Clique aqui
          </button>
        )}

        {/* Toggle RESERVA — só aparece fora do modo envio e sem manutenção ativa */}
        {!modoManutencao && !estadoSlot?.em_manutencao && (
          isReserva ? (
            reservaAtiva ? (
              /* Marcado nesta sessão — pode remover */
              <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
                <span className="text-sm font-semibold text-blue-600">RESERVA ✓</span>
                <button
                  onClick={async () => {
                    await marcarReserva({ localId: local.id, slot: slotAtivo, valor: false })
                    setReservaAtiva(false)
                    onAtualizar()
                  }}
                  className="text-xs text-slate-400 underline"
                >
                  Remover
                </button>
              </div>
            ) : (
              /* Já era RESERVA ao abrir */
              <div className="space-y-2">
                <div className={`flex items-center justify-between border rounded-xl px-4 py-3 transition-colors ${modoSubstituicao ? 'bg-blue-100 border-blue-300' : 'bg-blue-50 border-blue-200'}`}>
                  <span className="text-sm font-semibold text-blue-600">RESERVA</span>
                  <button
                    onClick={() => setModoSubstituicao(v => !v)}
                    className={`text-xs font-semibold px-3 py-1 rounded-lg border transition-colors ${modoSubstituicao ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-blue-600 border-blue-300 hover:border-blue-400'}`}
                  >
                    {modoSubstituicao ? 'Substituindo ✓' : 'Substituir'}
                  </button>
                </div>
                {modoSubstituicao && (
                  <p className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 leading-relaxed">
                    Conclua a substituição preenchendo com os dados do Extintor da SCI abaixo.
                  </p>
                )}
              </div>
            )
          ) : (
            <button
              onClick={async () => {
                await marcarReserva({ localId: local.id, slot: slotAtivo, valor: true })
                setReservaAtiva(true)
                onAtualizar()
              }}
              className="w-full border border-dashed border-blue-300 bg-white rounded-xl py-3 text-sm text-blue-500 text-center hover:border-blue-400 transition-colors"
            >
              + Marcar como <span className="text-blue-600 font-semibold">RESERVA</span>
            </button>
          )
        )}

        {/* Formulário de envio para manutenção */}
        {modoManutencao === 'envio' && (
          <FormEnvioManutencao
            local={local}
            slot={slotAtivo}
            tiposExtintor={tiposExtintor}
            fatores={fatores}
            anosN3={ANOS_N3}
            equipes={EQUIPES}
            bloqueado={!responsavel}
            onCancelar={() => envioPreAberto ? onClose() : setModoManutencao(null)}
            onSubmit={async ({ envio, inspecao }) => {
              if (!responsavel) { alert('Informe seu nome antes de registrar.'); return }
              const conformidade = calcularConformidade({
                capExtAtual: inspecao.cap_ext_atual,
                capExtExigida: local.planta_cap_ext_exigida,
                tipoAtual: inspecao.extintor_tipo,
                tipoExigido: local.planta_tipo_exigido
              })
              await registrarEnvioManutencao({
                localId: local.id,
                slot: slotAtivo,
                responsavel,
                equipe: inspecao.equipe,
                envio,
                inspecao,
                conformidade
              })
              onAtualizar()
              onClose()
            }}
          />
        )}

        {/* Formulário de inspeção normal — só oculto no modo envio */}
        {modoManutencao !== 'envio' && (
          <FormInspecao
            local={local}
            slot={slotAtivo}
            estadoAtual={estadoSlot}
            tiposExtintor={tiposExtintor}
            fatores={fatores}
            anosN3={ANOS_N3}
            equipes={EQUIPES}
            titulo="Formulário de Inspeção"
            onSubmit={handleRegistrarInspecao}
            bloqueado={!responsavel}
          />
        )}
      </div>
    </div>,
    document.body
  )
}
