// Ilustração da caixa de hidrante (abrigo de mangueira) usada nas listas de
// cadastro e vistoria — vista de frente, seguindo o padrão real de caixa
// metálica de embutir pra mangueira de incêndio: moldura vermelha embutida,
// janela circular com etiqueta amarela "INCÊNDIO", maçaneta redonda e duas
// grelhas de ventilação na parte inferior. Mesmo padrão técnico do
// IconeCCI (viewBox próprio, gradientes em defs, width/height 100%).
// viewBox 220x288: caixa original de 200x320 com altura -10% e largura +10%.
export default function IconeCaixaHidrante({ numero, className }) {
  // Etiqueta "INCÊNDIO" com laterais acompanhando a curva do círculo da
  // janela — os lados esquerdo/direito são arcos do próprio círculo, só o
  // topo e a base ficam retos.
  // Círculo ligeiramente menor, mantendo o topo na mesma altura (44.2, a
  // mesma distância da borda superior de antes) — só o raio diminui, dando
  // mais espaço abaixo pro número.
  const circR = 40
  const circCx = 110, circCy = 44.2 + circR
  const faixaY1 = circCy - 14.5 * (circR / 44), faixaY2 = circCy + 14.5 * (circR / 44)
  const meiaLarguraTopo = Math.sqrt(circR ** 2 - (faixaY1 - circCy) ** 2)
  const meiaLarguraBase = Math.sqrt(circR ** 2 - (faixaY2 - circCy) ** 2)
  const faixaPath = [
    `M ${circCx - meiaLarguraTopo},${faixaY1}`,
    `L ${circCx + meiaLarguraTopo},${faixaY1}`,
    `A ${circR},${circR} 0 0 1 ${circCx + meiaLarguraBase},${faixaY2}`,
    `L ${circCx - meiaLarguraBase},${faixaY2}`,
    `A ${circR},${circR} 0 0 1 ${circCx - meiaLarguraTopo},${faixaY1}`,
    'Z'
  ].join(' ')

  return (
    <svg viewBox="0 0 220 288" width="100%" height="100%" className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="hid-redGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#E5433F"/>
          <stop offset="55%" stopColor="#D32F2F"/>
          <stop offset="100%" stopColor="#A82424"/>
        </linearGradient>

        <radialGradient id="hid-glassGrad" cx="35%" cy="35%" r="75%">
          <stop offset="0%" stopColor="#2E4A4E"/>
          <stop offset="100%" stopColor="#122224"/>
        </radialGradient>

        <linearGradient id="hid-handleFade" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#000" stopOpacity="0.6"/>
          <stop offset="100%" stopColor="#000" stopOpacity="0"/>
        </linearGradient>
      </defs>

      {/* Moldura embutida */}
      <rect x="8.8" y="7.2" width="202.4" height="273.6" rx="6" fill="#8A1717"/>
      {/* Porta */}
      <rect x="18.7" y="15.3" width="182.6" height="257.4" rx="4" fill="url(#hid-redGrad)"/>

      {/* Janela circular com vidro escuro */}
      <circle cx={circCx} cy={circCy} r={circR} fill="url(#hid-glassGrad)" stroke="#7A1414" strokeWidth="3"/>

      {/* Etiqueta amarela "INCÊNDIO" cruzando a janela — laterais seguindo a curva do círculo */}
      <path d={faixaPath} fill="#FFDD00" stroke="#B89600" strokeWidth="1"/>
      <text x={circCx} y={circCy + 7.5 * (circR / 44)} fontFamily="Arial, sans-serif" fontWeight="bold" fontSize={17 * (circR / 44)}
        fill="#D32F2F" textAnchor="middle" letterSpacing="0">INCÊNDIO</text>

      {/* Número do hidrante — abaixo do círculo escuro, em branco, maior */}
      {numero && (
        <text x="110" y="196" fontFamily="Arial, sans-serif" fontWeight="bold" fontSize="60"
          fill="#FFF" textAnchor="middle">
          {String(numero).padStart(2, '0')}
        </text>
      )}

      {/* Abridor de porta — meia-lua espelhada e alongada (bojo à esquerda), próxima da borda esquerda, sombra preta sumindo da esquerda pra direita */}
      <path d="M 29,144.2 L 29,176.2 A 8,16 0 0 0 29,144.2 Z" fill="url(#hid-handleFade)"/>

      {/* Grelhas de ventilação */}
      {[52.8, 129.8].map(x => (
        <g key={x}>
          <rect x={x} y="226.8" width="37.4" height="27" rx="2" fill="#8A1717" opacity="0.4"/>
          {[0, 1, 2, 3].map(i => (
            <line key={i} x1={x + 6.6} y1={234 + i * 5.4} x2={x + 30.8} y2={234 + i * 5.4} stroke="#7A1414" strokeWidth="2.5"/>
          ))}
        </g>
      ))}
    </svg>
  )
}
