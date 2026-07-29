export default function BadgeSituacaoCci({ situacao }) {
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${situacao === 'LINHA' ? 'bg-sci-red text-white' : 'bg-slate-100 text-slate-500'}`}>
      {situacao === 'LINHA' ? 'LINHA' : 'RT'}
    </span>
  )
}
