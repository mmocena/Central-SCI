import { unidadeDoTipo } from '../lib/formato'
import { corTipo } from '../lib/coresTipo'
import AcoesKebab from './AcoesKebab'

// Par de setas − valor + usado na linha em edição (só aparece depois de
// clicar "Gerenciar" no kebab daquela linha).
export function Stepper({ valor, cor, onDelta }) {
  return (
    <div className="flex items-center justify-center gap-0.5">
      <button
        onClick={() => onDelta(-1)}
        disabled={valor === 0}
        className="w-5 h-5 rounded border border-slate-200 text-slate-500 text-xs leading-none flex items-center justify-center hover:bg-slate-50 disabled:opacity-30"
      >−</button>
      <span className={`w-5 text-center text-sm font-semibold ${valor === 0 ? 'text-slate-300' : cor}`}>{valor}</span>
      <button
        onClick={() => onDelta(1)}
        className="w-5 h-5 rounded border border-slate-200 text-slate-500 text-xs leading-none flex items-center justify-center hover:bg-slate-50"
      >+</button>
    </div>
  )
}

// Barra Salvar/Cancelar que aparece abaixo da linha em edição.
function BarraSalvarCancelar({ onSalvar, onCancelar, salvando }) {
  return (
    <div className="flex gap-2 px-4 py-2 bg-slate-50 border-t border-slate-100">
      <button onClick={onCancelar} disabled={salvando} className="btn-secondary flex-1 text-sm py-1.5 disabled:opacity-40">
        Cancelar
      </button>
      <button onClick={onSalvar} disabled={salvando} className="btn-primary flex-1 text-sm py-1.5 disabled:opacity-40">
        {salvando ? 'Salvando...' : 'Salvar'}
      </button>
    </div>
  )
}

// Monta as ações do kebab de uma linha — Gerenciar sempre, Item
// compartilhado só quando permitido (categoria OUTRO), Excluir sempre.
function acoesLinha({ linha, permiteCompartilhar, onGerenciar, onCompartilhar, onExcluir }) {
  const acoes = [{ label: 'Gerenciar', onClick: () => onGerenciar(linha) }]
  if (permiteCompartilhar) {
    acoes.push({
      label: 'Item compartilhado',
      checked: linha.compartilhado,
      onClick: () => onCompartilhar(linha),
      info: 'Este item também aparece no Depósito/Estoque do outro setor.'
    })
  }
  acoes.push({ label: 'Excluir', destrutivo: true, onClick: () => onExcluir(linha) })
  return acoes
}

export function TabelaEstoque({
  titulo, indicador, linhas, tiposExtintor, vazio, categoria,
  linhaEditando, rascunho, setRascunho, salvandoLinha,
  onGerenciar, onSalvarLinha, onCancelarLinha, onExcluir
}) {
  const total = linhas.reduce((acc, l) => ({ oper: acc.oper + l.oper, naoOper: acc.naoOper + l.naoOper }), { oper: 0, naoOper: 0 })
  const colunas = 'grid grid-cols-[1fr,4.5rem,4.5rem,3.5rem,1.75rem] gap-1 items-center'

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-1 flex items-center gap-2">
        {indicador}{titulo}
      </p>
      {linhas.length === 0 ? (
        <div className="card text-center py-4 text-slate-400 text-sm">{vazio}</div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className={`${colunas} px-4 py-2 bg-slate-50 rounded-t-2xl text-[10px] font-semibold text-slate-400 uppercase tracking-wide`}>
            <span>Tipo</span>
            <span className="text-center">Oper.</span>
            <span className="text-center">Não op.</span>
            <span className="text-center">Total</span>
            <span />
          </div>
          <div className="divide-y divide-slate-100">
            {linhas.map(l => {
              const chave = `${categoria}|${l.tipo}|${l.kg}`
              const editando = linhaEditando === chave
              const cor = corTipo(l.tipo)
              return (
                <div key={chave}>
                  <div className={`${colunas} px-4 py-2.5 ${cor.bg}`}>
                    <span className={`text-sm font-medium truncate ${cor.text}`}>{l.tipo} {l.kg}{unidadeDoTipo(l.tipo, tiposExtintor)}</span>
                    {editando ? (
                      <Stepper valor={rascunho.atual.oper} cor="text-green-700" onDelta={d => setRascunho(r => ({ ...r, atual: { ...r.atual, oper: Math.max(0, r.atual.oper + d) } }))} />
                    ) : (
                      <span className={`text-center text-sm font-semibold ${l.oper === 0 ? 'text-slate-300' : 'text-green-700'}`}>{l.oper}</span>
                    )}
                    {editando ? (
                      <Stepper valor={rascunho.atual.naoOper} cor="text-amber-700" onDelta={d => setRascunho(r => ({ ...r, atual: { ...r.atual, naoOper: Math.max(0, r.atual.naoOper + d) } }))} />
                    ) : (
                      <span className={`text-center text-sm font-semibold ${l.naoOper === 0 ? 'text-slate-300' : 'text-amber-700'}`}>{l.naoOper}</span>
                    )}
                    <span className="text-center text-sm font-bold text-sci-text">{l.oper + l.naoOper}</span>
                    <AcoesKebab acoes={acoesLinha({ linha: l, permiteCompartilhar: false, onGerenciar, onExcluir })} />
                  </div>
                  {editando && <BarraSalvarCancelar onSalvar={onSalvarLinha} onCancelar={onCancelarLinha} salvando={salvandoLinha} />}
                </div>
              )
            })}
          </div>
          <div className={`${colunas} px-4 py-2.5 bg-slate-50 rounded-b-2xl border-t border-slate-200`}>
            <span className="text-xs font-semibold text-slate-500 uppercase">Total</span>
            <span className="text-center text-sm font-bold text-green-700">{total.oper}</span>
            <span className="text-center text-sm font-bold text-amber-700">{total.naoOper}</span>
            <span className="text-center text-sm font-bold text-sci-text">{total.oper + total.naoOper}</span>
            <span />
          </div>
        </div>
      )}
    </div>
  )
}

// TIPO(+kg) | QTD — usada pra RESERVA (sempre operacional, sem compartilhar)
// e Outros (sem kg, nome livre, com compartilhar).
export function TabelaSimples({
  titulo, indicador, linhas, tiposExtintor, vazio, categoria, comKg = true, permiteCompartilhar = false,
  linhaEditando, rascunho, setRascunho, salvandoLinha,
  onGerenciar, onSalvarLinha, onCancelarLinha, onCompartilhar, onExcluir
}) {
  const total = linhas.reduce((s, l) => s + l.qtd, 0)
  const colunas = 'grid grid-cols-[1fr,4.5rem,1.75rem] gap-1 items-center'

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-1 flex items-center gap-2">
        {indicador}{titulo}
      </p>
      {linhas.length === 0 ? (
        <div className="card text-center py-4 text-slate-400 text-sm">{vazio}</div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className={`${colunas} px-4 py-2 bg-slate-50 rounded-t-2xl text-[10px] font-semibold text-slate-400 uppercase tracking-wide`}>
            <span>{comKg ? 'Tipo' : 'Nome do item'}</span>
            <span className="text-center">Qtd.</span>
            <span />
          </div>
          <div className="divide-y divide-slate-100">
            {linhas.map(l => {
              const chave = `${categoria}|${l.tipo}|${l.kg}`
              const editando = linhaEditando === chave
              const cor = comKg ? corTipo(l.tipo) : null
              return (
                <div key={chave}>
                  <div className={`${colunas} px-4 py-2.5 ${cor ? cor.bg : ''}`}>
                    <span className={`text-sm truncate flex items-center gap-1.5 ${cor ? `font-medium ${cor.text}` : 'text-slate-600'}`}>
                      {l.tipo}{comKg ? ` ${l.kg}${unidadeDoTipo(l.tipo, tiposExtintor)}` : ''}
                      {l.compartilhado && <span title="Item compartilhado entre setores" className="text-xs">🔗</span>}
                    </span>
                    {editando ? (
                      <Stepper valor={rascunho.atual.qtd} cor="text-sci-text" onDelta={d => setRascunho(r => ({ ...r, atual: { ...r.atual, qtd: Math.max(0, r.atual.qtd + d) } }))} />
                    ) : (
                      <span className={`text-center text-sm font-bold ${l.qtd === 0 ? 'text-slate-300' : 'text-sci-text'}`}>{l.qtd}</span>
                    )}
                    <AcoesKebab acoes={acoesLinha({ linha: l, permiteCompartilhar, onGerenciar, onCompartilhar, onExcluir })} />
                  </div>
                  {editando && <BarraSalvarCancelar onSalvar={onSalvarLinha} onCancelar={onCancelarLinha} salvando={salvandoLinha} />}
                </div>
              )
            })}
          </div>
          <div className={`${colunas} px-4 py-2.5 bg-slate-50 rounded-b-2xl border-t border-slate-200`}>
            <span className="text-xs font-semibold text-slate-500 uppercase">Total</span>
            <span className="text-center text-sm font-bold text-sci-text">{total}</span>
            <span />
          </div>
        </div>
      )}
    </div>
  )
}
