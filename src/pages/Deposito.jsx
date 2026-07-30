import { useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { fetchEstoqueDeposito, fetchTiposExtintor, ajustarEstoqueDeposito, upsertItemDeposito, excluirItemDeposito, atualizarCampoAdmin, salvarRegistroAdmin } from '../lib/queries'
import { unidadeDoTipo } from '../lib/formato'
import { visivelNoSetor, agruparOperNaoOper, agruparSimples } from '../lib/estoqueDeposito'
import { TabelaEstoque, TabelaSimples } from '../components/TabelasEstoqueDeposito'
import ModalEscolherSetorDeposito from '../components/ModalEscolherSetorDeposito'
import { useToast } from '../components/Toast'

const MEU_SETOR = 'EXTINTORES'

// Formulário "Adicionar item" é revelado em etapas: grupo -> categoria (só em
// Extintores) -> operacional (só em SCI) -> tipo/kg. Cada campo começa vazio
// pra nada aparecer antes do usuário escolher a etapa anterior.
const FORM_VAZIO = { grupo: '', categoria: '', operacional: null, tipo: '', kg: '', nome: '' }

export default function Deposito() {
  const showToast = useToast()
  const [estoque, setEstoque] = useState([])
  const [tipos, setTipos] = useState([])
  const [loading, setLoading] = useState(true)

  const [abaAtiva, setAbaAtiva] = useState('extintores')

  const [formAberto, setFormAberto] = useState(false)
  const [form, setForm] = useState(FORM_VAZIO)
  const [adicionando, setAdicionando] = useState(false)
  const [modalTipoAberto, setModalTipoAberto] = useState(false)
  const [novoTipo, setNovoTipo] = useState({ tipo: '', kg: '', unidade: 'kg' })
  const [salvandoTipo, setSalvandoTipo] = useState(false)

  // Edição por linha — só a linha clicada em "Gerenciar" fica editável
  // (steppers + barra Salvar/Cancelar abaixo dela). Sem rascunho de página
  // inteira: cada Salvar escreve direto no banco.
  const [linhaEditando, setLinhaEditando] = useState(null)
  const [rascunho, setRascunho] = useState(null)
  const [salvandoLinha, setSalvandoLinha] = useState(false)

  // Modal de confirmação antes de excluir um item — evita exclusão
  // acidental por toque/clique sem querer no kebab.
  const [confirmExcluir, setConfirmExcluir] = useState(null)

  // Ao desmarcar "Item compartilhado", pergunta em qual setor o item
  // permanece (pode ser diferente do setor que originalmente cadastrou).
  const [confirmDesmarcar, setConfirmDesmarcar] = useState(null)

  const carregar = useCallback(async () => {
    const [estoqueData, tiposData] = await Promise.all([fetchEstoqueDeposito(), fetchTiposExtintor()])
    setEstoque(estoqueData)
    setTipos(tiposData)
    setLoading(false)
  }, [])

  useEffect(() => { carregar() }, [carregar])

  async function criarItem({ tipo, kg, categoria, operacional }) {
    const jaExiste = estoque.some(e => e.tipo === tipo && e.kg === kg && e.categoria === categoria && e.operacional === operacional && e.setor === MEU_SETOR)
    if (jaExiste) {
      showToast('Este item já está na lista.', 'aviso')
      return
    }
    setAdicionando(true)
    try {
      const resultado = await upsertItemDeposito({ tipo, kg, categoria, operacional, setor: MEU_SETOR })
      showToast(
        resultado.queued ? 'Sem conexão — será adicionado automaticamente ao reconectar.' : 'Item adicionado.',
        resultado.queued ? 'aviso' : 'sucesso'
      )
      setForm(FORM_VAZIO)
      setFormAberto(false)
      await carregar()
    } catch (e) {
      showToast('Erro: ' + e.message, 'erro')
    } finally {
      setAdicionando(false)
    }
  }

  function handleAdicionarLocal() {
    const categoria = form.categoria
    if (categoria === 'OUTRO') {
      const nome = form.nome.trim()
      if (!nome) return
      criarItem({ tipo: nome, kg: 0, categoria: 'OUTRO', operacional: true })
    } else {
      if (!form.tipo || !form.kg) return
      const operacional = categoria === 'RESERVA' ? true : form.operacional
      criarItem({ tipo: form.tipo, kg: parseFloat(form.kg), categoria, operacional })
    }
  }

  async function handleAdicionarTipo() {
    if (!novoTipo.tipo.trim() || !novoTipo.kg) return
    setSalvandoTipo(true)
    try {
      const resultado = await salvarRegistroAdmin({
        tabela: 'tipos_extintor',
        payload: { tipo: novoTipo.tipo.trim(), kg: parseFloat(novoTipo.kg), unidade: novoTipo.unidade }
      })
      showToast(
        resultado.queued ? 'Sem conexão — será adicionado automaticamente ao reconectar.' : 'Tipo adicionado.',
        resultado.queued ? 'aviso' : 'sucesso'
      )
      setForm(f => ({ ...f, tipo: novoTipo.tipo.trim(), kg: String(novoTipo.kg) }))
      setNovoTipo({ tipo: '', kg: '', unidade: 'kg' })
      setModalTipoAberto(false)
      const tiposData = await fetchTiposExtintor()
      setTipos(tiposData)
    } catch (e) {
      alert('Erro: ' + e.message)
    } finally {
      setSalvandoTipo(false)
    }
  }

  function handleGerenciarLinha(categoria, linha) {
    const chave = `${categoria}|${linha.tipo}|${linha.kg}`
    const atual = 'oper' in linha ? { oper: linha.oper, naoOper: linha.naoOper } : { qtd: linha.qtd }
    setLinhaEditando(chave)
    setRascunho({ categoria, tipo: linha.tipo, kg: linha.kg, original: atual, atual: { ...atual } })
  }

  function handleCancelarLinha() {
    setLinhaEditando(null)
    setRascunho(null)
  }

  async function handleSalvarLinha() {
    const { categoria, tipo, kg, original, atual } = rascunho
    setSalvandoLinha(true)
    try {
      let filaAtiva = false
      async function aplicar(operacional, delta) {
        if (delta === 0) return
        await upsertItemDeposito({ tipo, kg, categoria, operacional, setor: MEU_SETOR })
        const r = await ajustarEstoqueDeposito({ tipo, kg, categoria, operacional, setor: MEU_SETOR, delta })
        if (r.queued) filaAtiva = true
      }
      if ('oper' in atual) {
        await aplicar(true, atual.oper - original.oper)
        await aplicar(false, atual.naoOper - original.naoOper)
      } else {
        await aplicar(true, atual.qtd - original.qtd)
      }
      showToast(filaAtiva ? 'Sem conexão — será enviado automaticamente ao reconectar.' : 'Alterações salvas.', filaAtiva ? 'aviso' : 'sucesso')
      setLinhaEditando(null)
      setRascunho(null)
      await carregar()
    } catch (e) {
      showToast('Erro ao salvar: ' + e.message, 'erro')
    } finally {
      setSalvandoLinha(false)
    }
  }

  function handleCompartilhar(linha) {
    const item = estoque.find(e => e.categoria === 'OUTRO' && e.tipo === linha.tipo && e.kg === linha.kg && e.operacional === true)
    if (!item) return
    if (item.compartilhado) {
      // Desmarcar tira o item da vista do outro setor — pergunta onde fica.
      setConfirmDesmarcar(item)
      return
    }
    aplicarCompartilhamento(item, { compartilhado: true, setor: item.setor })
  }

  async function aplicarCompartilhamento(item, campos) {
    try {
      const resultado = await atualizarCampoAdmin({ tabela: 'estoque_deposito', id: item.id, campos })
      showToast(
        resultado.queued
          ? 'Sem conexão — será enviado automaticamente ao reconectar.'
          : (campos.compartilhado ? 'Item marcado como compartilhado.' : 'Item deixou de ser compartilhado.'),
        resultado.queued ? 'aviso' : 'sucesso'
      )
      await carregar()
    } catch (e) {
      showToast('Erro: ' + e.message, 'erro')
    }
  }

  function handlePedirExclusao(categoria, linha) {
    const label = linha.kg ? `${linha.tipo} ${linha.kg}${unidadeDoTipo(linha.tipo, tipos)}` : linha.tipo
    setConfirmExcluir({ label, onConfirmar: () => handleExcluirImediato(categoria, linha.tipo, linha.kg) })
  }

  async function handleExcluirImediato(categoria, tipo, kg) {
    const itens = estoque.filter(e => e.categoria === categoria && e.tipo === tipo && e.kg === kg)
    try {
      let filaAtiva = false
      for (const item of itens) {
        const r = await excluirItemDeposito(item.id)
        if (r.queued) filaAtiva = true
      }
      showToast(filaAtiva ? 'Sem conexão — será enviado automaticamente ao reconectar.' : 'Item excluído.', filaAtiva ? 'aviso' : 'sucesso')
      await carregar()
    } catch (e) {
      showToast('Erro: ' + e.message, 'erro')
    }
  }

  if (loading) return <div className="p-4 text-sm text-slate-500">Carregando...</div>

  const sciOk   = estoque.filter(e => e.categoria === 'SCI' && e.operacional === true)
  const sciNok  = estoque.filter(e => e.categoria === 'SCI' && e.operacional === false)
  const reserva = estoque.filter(e => e.categoria === 'RESERVA')
  const outros  = estoque.filter(e => e.categoria === 'OUTRO' && visivelNoSetor(e, MEU_SETOR))

  return (
    <div className="p-4 space-y-4">

      {/* Abas: Extintores / Outros */}
      <div className="flex gap-2">
        {[{ valor: 'extintores', label: 'Extintores' }, { valor: 'outros', label: 'Outros' }].map(a => (
          <button
            key={a.valor}
            onClick={() => {
              setAbaAtiva(a.valor)
              if (formAberto) {
                const grupo = a.valor === 'outros' ? 'OUTRO' : 'EXTINTORES'
                setForm({ ...FORM_VAZIO, grupo, categoria: grupo === 'OUTRO' ? 'OUTRO' : '' })
              }
            }}
            className={`btn-option flex-1 text-sm font-semibold ${abaAtiva === a.valor ? 'selected' : ''}`}
          >
            {a.label}
          </button>
        ))}
      </div>

      {/* Adicionar item — sempre visível */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <button
          onClick={() => {
            const abrindo = !formAberto
            setFormAberto(abrindo)
            if (abrindo) {
              const grupo = abaAtiva === 'outros' ? 'OUTRO' : 'EXTINTORES'
              setForm({ ...FORM_VAZIO, grupo, categoria: grupo === 'OUTRO' ? 'OUTRO' : '' })
            }
          }}
          className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50 transition-colors"
        >
          <span className="text-sm font-semibold text-sci-text">+ Adicionar item ao Estoque</span>
          <span className="text-slate-400 text-sm">{formAberto ? '▲' : '▼'}</span>
        </button>

        {formAberto && (
          <div className="border-t border-slate-100 p-4 space-y-3">
            {/* Etapa 1: SCI ou RESERVA — só pra Extintores (grupo já vem da aba ativa) */}
            {form.grupo === 'EXTINTORES' && (
              <div className="flex gap-2">
                {[{ valor: 'SCI', label: 'SCI' }, { valor: 'RESERVA', label: 'RESERVA' }].map(c => (
                  <button
                    key={c.valor}
                    onClick={() => setForm(f => ({ ...f, categoria: c.valor, operacional: null, tipo: '', kg: '' }))}
                    className={`btn-option flex-1 text-sm font-semibold ${form.categoria === c.valor ? 'selected' : ''}`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            )}

            {/* Etapa 2: Operacional/Não oper. — só depois de escolher SCI */}
            {form.categoria === 'SCI' && (
              <div className="flex gap-2">
                {[{ valor: true, label: 'Operacional' }, { valor: false, label: 'Não operacional' }].map(op => (
                  <button
                    key={String(op.valor)}
                    onClick={() => setForm(f => ({ ...f, operacional: op.valor, tipo: '', kg: '' }))}
                    className={`btn-option flex-1 text-sm ${form.operacional === op.valor ? 'selected' : ''}`}
                  >
                    {op.label}
                  </button>
                ))}
              </div>
            )}

            {form.categoria === 'OUTRO' && (
              /* Nome livre — sem tipo/kg da tabela de extintores */
              <div>
                <label className="text-xs text-slate-400">Nome do item</label>
                <input
                  type="text"
                  value={form.nome}
                  onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                  placeholder="ex: Placa de sinalização"
                  autoFocus
                  className="w-full mt-1"
                />
              </div>
            )}

            {/* Etapa 3: Tipo/kg — só depois de RESERVA, ou de SCI+operacional escolhidos */}
            {(form.categoria === 'RESERVA' || (form.categoria === 'SCI' && form.operacional !== null)) && (
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={form.tipo}
                  onChange={e => setForm(f => ({ ...f, tipo: e.target.value, kg: '' }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">Tipo</option>
                  {[...new Set(tipos.map(t => t.tipo))].sort().map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <div className="flex gap-1.5">
                  <select
                    value={form.kg}
                    onChange={e => setForm(f => ({ ...f, kg: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="">Carga</option>
                    {[...new Set(tipos.filter(t => !form.tipo || t.tipo === form.tipo).map(t => t.kg))].sort((a, b) => a - b).map(kg => (
                      <option key={kg} value={kg}>{kg}{unidadeDoTipo(form.tipo, tipos)}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setModalTipoAberto(true)}
                    className="shrink-0 w-9 h-9 rounded-lg border border-slate-200 text-slate-500 text-lg flex items-center justify-center hover:bg-slate-50"
                    aria-label="Adicionar novo tipo"
                  >+</button>
                </div>
              </div>
            )}

            <button
              onClick={handleAdicionarLocal}
              disabled={adicionando || (form.categoria === 'OUTRO' ? !form.nome.trim() : (!form.tipo || !form.kg))}
              className="btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {adicionando ? 'Adicionando...' : 'Adicionar'}
            </button>
          </div>
        )}
      </div>

      {abaAtiva === 'extintores' ? (
        <>
          {/* SCI — tabela Oper. / Não oper. / Total */}
          <TabelaEstoque
            titulo="SCI"
            indicador={<span className="w-2 h-2 rounded-full bg-green-500 inline-block" />}
            linhas={agruparOperNaoOper(sciOk, sciNok)}
            tiposExtintor={tipos}
            vazio="Nenhum extintor SCI no depósito."
            categoria="SCI"
            linhaEditando={linhaEditando}
            rascunho={rascunho}
            setRascunho={setRascunho}
            salvandoLinha={salvandoLinha}
            onGerenciar={linha => handleGerenciarLinha('SCI', linha)}
            onSalvarLinha={handleSalvarLinha}
            onCancelarLinha={handleCancelarLinha}
            onExcluir={linha => handlePedirExclusao('SCI', linha)}
          />

          {/* RESERVA — tabela simples (sempre operacional) */}
          <TabelaSimples
            titulo={<><span className="text-blue-600">RESERVA</span> — empresa</>}
            indicador={<span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />}
            linhas={agruparSimples(reserva)}
            tiposExtintor={tipos}
            vazio="Nenhum extintor RESERVA no depósito."
            categoria="RESERVA"
            linhaEditando={linhaEditando}
            rascunho={rascunho}
            setRascunho={setRascunho}
            salvandoLinha={salvandoLinha}
            onGerenciar={linha => handleGerenciarLinha('RESERVA', linha)}
            onSalvarLinha={handleSalvarLinha}
            onCancelarLinha={handleCancelarLinha}
            onExcluir={linha => handlePedirExclusao('RESERVA', linha)}
          />
        </>
      ) : (
        <TabelaSimples
          titulo="Outros itens"
          indicador={<span className="w-2 h-2 rounded-full bg-slate-400 inline-block" />}
          linhas={agruparSimples(outros)}
          tiposExtintor={tipos}
          vazio="Nenhum item cadastrado."
          categoria="OUTRO"
          comKg={false}
          permiteCompartilhar
          linhaEditando={linhaEditando}
          rascunho={rascunho}
          setRascunho={setRascunho}
          salvandoLinha={salvandoLinha}
          onGerenciar={linha => handleGerenciarLinha('OUTRO', linha)}
          onSalvarLinha={handleSalvarLinha}
          onCancelarLinha={handleCancelarLinha}
          onCompartilhar={handleCompartilhar}
          onExcluir={linha => handlePedirExclusao('OUTRO', linha)}
        />
      )}

      {/* Modal — novo tipo de extintor (portal: escapa do space-y-4 da
          página, que senão empurraria o overlay com margin-top) */}
      {modalTipoAberto && createPortal(
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => !salvandoTipo && setModalTipoAberto(false)}>
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className="font-semibold text-sci-text">Novo tipo de extintor</p>
              <button onClick={() => setModalTipoAberto(false)} className="text-sci-muted text-2xl leading-none w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100">×</button>
            </div>

            <div>
              <label className="text-xs text-slate-400">Tipo</label>
              <input
                type="text"
                value={novoTipo.tipo}
                onChange={e => setNovoTipo(f => ({ ...f, tipo: e.target.value }))}
                placeholder="ex: CO²"
                autoFocus
                className="w-full mt-1"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400">Carga</label>
              <input
                type="number"
                value={novoTipo.kg}
                onChange={e => setNovoTipo(f => ({ ...f, kg: e.target.value }))}
                placeholder="ex: 6"
                className="w-full mt-1"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400">Unidade</label>
              <div className="flex gap-2 mt-1">
                {['kg', 'L'].map(u => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => setNovoTipo(f => ({ ...f, unidade: u }))}
                    className={`btn-option flex-1 text-sm ${novoTipo.unidade === u ? 'selected' : ''}`}
                  >
                    {u}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleAdicionarTipo}
              disabled={!novoTipo.tipo.trim() || !novoTipo.kg || salvandoTipo}
              className="btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {salvandoTipo ? 'Adicionando...' : 'Adicionar'}
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* Modal — confirmação antes de excluir um item. Exclui de fato assim
          que confirmado (sem lote, sem "Salvar" separado). */}
      {confirmExcluir && createPortal(
        <div className="fixed inset-0 z-[260] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setConfirmExcluir(null)}>
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <p className="font-semibold text-sci-text">Excluir item?</p>
            <p className="text-sm text-slate-500">
              Remover <span className="font-medium text-sci-text">{confirmExcluir.label}</span> do Depósito permanentemente.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmExcluir(null)} className="btn-secondary flex-1">
                Cancelar
              </button>
              <button
                onClick={() => { const onConfirmar = confirmExcluir.onConfirmar; setConfirmExcluir(null); onConfirmar() }}
                className="btn-primary flex-1"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {confirmDesmarcar && (
        <ModalEscolherSetorDeposito
          nomeItem={confirmDesmarcar.tipo}
          setorAtual={confirmDesmarcar.setor}
          onCancelar={() => setConfirmDesmarcar(null)}
          onEscolher={setor => {
            const item = confirmDesmarcar
            setConfirmDesmarcar(null)
            aplicarCompartilhamento(item, { compartilhado: false, setor })
          }}
        />
      )}
    </div>
  )
}
