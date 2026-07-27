// Sentinel fixo (não vem do banco) pra opção "Outros" nos fatores — abre um
// campo de texto livre, tratado igual aos demais fatores no resto do fluxo.
// Compartilhado entre a inspeção de extintores (FormInspecao) e a vistoria
// de hidrantes/mangueiras — mesmo padrão de "categoria fixa + detalhe em
// texto livre" nos dois setores.
export const OUTROS_ID = '__outros__'

// Resolve os ids selecionados (incl. o sentinel de "Outros") pras descrições
// de fato usadas em Observações e guardadas no estado persistido.
export function descricoesFatores(catalogo, idsSelecionados, textoOutro) {
  return idsSelecionados
    .map(id => id === OUTROS_ID ? textoOutro.trim() : catalogo.find(f => f.id === id)?.descricao)
    .filter(Boolean)
}

// Lista de chips de fatores (não-operacionalidade, sinalização, integridade
// etc., conforme o catálogo passado) + opção "Outros" com campo de texto livre.
export default function FatorChips({ label, catalogo, selecionados, textoOutro, onToggle, onTextoOutro }) {
  return (
    <div className="mt-2 space-y-2 pl-3 border-l-2 border-red-200">
      <p className="text-xs text-slate-500 font-medium">{label} <span className="text-sci-red">obrigatório</span></p>
      {catalogo.map(f => {
        const sel = selecionados.includes(f.id)
        return (
          <button key={f.id} onClick={() => onToggle(f.id)} className="flex items-center gap-2 w-full text-left">
            <div className={`shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${sel ? 'border-sci-red bg-sci-red' : 'border-slate-300 bg-white'}`}>
              {sel && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
            </div>
            <span className="text-sm text-slate-700 flex-1">{f.descricao}</span>
          </button>
        )
      })}
      <button onClick={() => onToggle(OUTROS_ID)} className="flex items-center gap-2 w-full text-left">
        <div className={`shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${selecionados.includes(OUTROS_ID) ? 'border-sci-red bg-sci-red' : 'border-slate-300 bg-white'}`}>
          {selecionados.includes(OUTROS_ID) && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
        </div>
        <span className="text-sm text-slate-700 flex-1">Outros</span>
      </button>
      {selecionados.includes(OUTROS_ID) && (
        <input type="text" value={textoOutro} onChange={e => onTextoOutro(e.target.value)}
          placeholder="Descreva o motivo" className="w-full" />
      )}
    </div>
  )
}
