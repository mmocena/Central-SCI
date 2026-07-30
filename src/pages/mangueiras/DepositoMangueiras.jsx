import { useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { fetchEstoqueDeposito, ajustarEstoqueDeposito, upsertItemDeposito, excluirItemDeposito, atualizarCampoAdmin } from '../../lib/queries'
import { visivelNoSetor, agruparSimples } from '../../lib/estoqueDeposito'
import { TabelaSimples } from '../../components/TabelasEstoqueDeposito'
import ModalEscolherSetorDeposito from '../../components/ModalEscolherSetorDeposito'
import { useToast } from '../../components/Toast'
import { AdminMangueirasTab } from './AdminMangueiras'

const MEU_SETOR = 'MANGUEIRAS'

// Depósito/Estoque do setor Hidrantes/Mangueiras — mesmo espírito do
// Depósito de Extintores (src/pages/Deposito.jsx), com duas abas:
// "Mangueiras" (sobressalentes, reaproveitando 100% o AdminMangueirasTab já
// existente no Cadastro, filtrado pra localização Depósito) e "Outros"
// (itens soltos, compartilháveis com o Depósito de Extintores via o mesmo
// flag `compartilhado`).
export default function DepositoMangueiras() {
  const showToast = useToast()
  const [estoque, setEstoque] = useState([])
  const [loading, setLoading] = useState(true)

  const [abaAtiva, setAbaAtiva] = useState('mangueiras')

  const [formAberto, setFormAberto] = useState(false)
  const [nomeItem, setNomeItem] = useState('')
  const [adicionando, setAdicionando] = useState(false)

  const [linhaEditando, setLinhaEditando] = useState(null)
  const [rascunho, setRascunho] = useState(null)
  const [salvandoLinha, setSalvandoLinha] = useState(false)

  const [confirmExcluir, setConfirmExcluir] = useState(null)
  const [confirmDesmarcar, setConfirmDesmarcar] = useState(null)

  const carregar = useCallback(async () => {
    setEstoque(await fetchEstoqueDeposito())
    setLoading(false)
  }, [])

  useEffect(() => { carregar() }, [carregar])

  async function handleAdicionarItem() {
    const nome = nomeItem.trim()
    if (!nome) return
    const jaExiste = estoque.some(e => e.categoria === 'OUTRO' && e.tipo === nome && e.setor === MEU_SETOR)
    if (jaExiste) {
      showToast('Este item já está na lista.', 'aviso')
      return
    }
    setAdicionando(true)
    try {
      const resultado = await upsertItemDeposito({ tipo: nome, kg: 0, categoria: 'OUTRO', operacional: true, setor: MEU_SETOR })
      showToast(
        resultado.queued ? 'Sem conexão — será adicionado automaticamente ao reconectar.' : 'Item adicionado.',
        resultado.queued ? 'aviso' : 'sucesso'
      )
      setNomeItem('')
      setFormAberto(false)
      await carregar()
    } catch (e) {
      showToast('Erro: ' + e.message, 'erro')
    } finally {
      setAdicionando(false)
    }
  }

  function handleGerenciarLinha(linha) {
    setLinhaEditando(`OUTRO|${linha.tipo}|${linha.kg}`)
    setRascunho({ tipo: linha.tipo, kg: linha.kg, original: { qtd: linha.qtd }, atual: { qtd: linha.qtd } })
  }

  function handleCancelarLinha() {
    setLinhaEditando(null)
    setRascunho(null)
  }

  async function handleSalvarLinha() {
    const { tipo, kg, original, atual } = rascunho
    const delta = atual.qtd - original.qtd
    setSalvandoLinha(true)
    try {
      let filaAtiva = false
      if (delta !== 0) {
        await upsertItemDeposito({ tipo, kg, categoria: 'OUTRO', operacional: true, setor: MEU_SETOR })
        const r = await ajustarEstoqueDeposito({ tipo, kg, categoria: 'OUTRO', operacional: true, setor: MEU_SETOR, delta })
        if (r.queued) filaAtiva = true
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

  function handlePedirExclusao(linha) {
    setConfirmExcluir({ label: linha.tipo, onConfirmar: () => handleExcluirImediato(linha.tipo, linha.kg) })
  }

  async function handleExcluirImediato(tipo, kg) {
    const itens = estoque.filter(e => e.categoria === 'OUTRO' && e.tipo === tipo && e.kg === kg)
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

  const outros = estoque.filter(e => e.categoria === 'OUTRO' && visivelNoSetor(e, MEU_SETOR))

  return (
    <div className="p-4 space-y-4">
      <div>
        <p className="text-sm font-bold text-sci-text">Depósito — Hidrantes/Mangueiras</p>
        <p className="text-xs text-slate-400">Mangueiras sobressalentes e outros itens</p>
      </div>

      <div className="flex gap-2">
        {[{ valor: 'mangueiras', label: 'Mangueiras' }, { valor: 'outros', label: 'Outros' }].map(a => (
          <button
            key={a.valor}
            onClick={() => setAbaAtiva(a.valor)}
            className={`btn-option flex-1 text-sm font-semibold ${abaAtiva === a.valor ? 'selected' : ''}`}
          >
            {a.label}
          </button>
        ))}
      </div>

      {abaAtiva === 'mangueiras' ? (
        <AdminMangueirasTab localizacaoFixa="DEPOSITO" />
      ) : (
        <>
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <button
              onClick={() => setFormAberto(v => !v)}
              className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50 transition-colors"
            >
              <span className="text-sm font-semibold text-sci-text">+ Adicionar item ao Estoque</span>
              <span className="text-slate-400 text-sm">{formAberto ? '▲' : '▼'}</span>
            </button>

            {formAberto && (
              <div className="border-t border-slate-100 p-4 space-y-3">
                <div>
                  <label className="text-xs text-slate-400">Nome do item</label>
                  <input
                    type="text"
                    value={nomeItem}
                    onChange={e => setNomeItem(e.target.value)}
                    placeholder="ex: Chave de mangueira"
                    autoFocus
                    className="w-full mt-1"
                  />
                </div>
                <button
                  onClick={handleAdicionarItem}
                  disabled={adicionando || !nomeItem.trim()}
                  className="btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {adicionando ? 'Adicionando...' : 'Adicionar'}
                </button>
              </div>
            )}
          </div>

          <TabelaSimples
            titulo="Outros itens"
            indicador={<span className="w-2 h-2 rounded-full bg-slate-400 inline-block" />}
            linhas={agruparSimples(outros)}
            vazio="Nenhum item cadastrado."
            categoria="OUTRO"
            comKg={false}
            permiteCompartilhar
            linhaEditando={linhaEditando}
            rascunho={rascunho}
            setRascunho={setRascunho}
            salvandoLinha={salvandoLinha}
            onGerenciar={handleGerenciarLinha}
            onSalvarLinha={handleSalvarLinha}
            onCancelarLinha={handleCancelarLinha}
            onCompartilhar={handleCompartilhar}
            onExcluir={handlePedirExclusao}
          />
        </>
      )}

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
