// Ilustração de CCI (viatura) usada na lista de vistoria — cabine
// quadrada, faixa vermelha só na cabine, número do veículo em preto na
// área amarela livre da carroceria (traseira).
export default function IconeCCI({ numero, className }) {
  return (
    <svg viewBox="0 0 1000 500" width="100%" height="100%" className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="cci-yellowGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FFDD00"/>
          <stop offset="100%" stopColor="#DAB000"/>
        </linearGradient>

        <linearGradient id="cci-darkGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#3A3D40"/>
          <stop offset="100%" stopColor="#1A1C1E"/>
        </linearGradient>

        <radialGradient id="cci-tireGrad" cx="50%" cy="50%" r="50%">
          <stop offset="60%" stopColor="#1A1A1A"/>
          <stop offset="85%" stopColor="#333333"/>
          <stop offset="100%" stopColor="#0F0F0F"/>
        </radialGradient>

        <linearGradient id="cci-wheelGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#E0E0E0"/>
          <stop offset="50%" stopColor="#888888"/>
          <stop offset="100%" stopColor="#444444"/>
        </linearGradient>

        <linearGradient id="cci-glassGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4A6572" stopOpacity="0.8"/>
          <stop offset="100%" stopColor="#1A232A" stopOpacity="0.9"/>
        </linearGradient>

        <linearGradient id="cci-metalGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#E6E6E6"/>
          <stop offset="20%" stopColor="#AEAEAE"/>
          <stop offset="40%" stopColor="#E6E6E6"/>
          <stop offset="60%" stopColor="#B0B0B0"/>
          <stop offset="80%" stopColor="#E6E6E6"/>
          <stop offset="100%" stopColor="#999999"/>
        </linearGradient>

        <pattern id="cci-shutterPattern" width="100" height="8" patternUnits="userSpaceOnUse">
          <line x1="0" y1="0" x2="100" y2="0" stroke="#777" strokeWidth="1.5"/>
          <line x1="0" y1="4" x2="100" y2="4" stroke="#FFF" strokeWidth="1"/>
        </pattern>
      </defs>

      <g id="truck">
        <ellipse cx="320" cy="415" rx="65" ry="8" fill="#000000" opacity="0.3"/>
        <ellipse cx="665" cy="415" rx="65" ry="8" fill="#000000" opacity="0.3"/>

        {/* Chassi — parte alongada da traseira preenchida em ângulo "\" até a ponta; completa até o para-choque dianteiro */}
        <polygon points="190,340 785,340 785,375 230,375" fill="url(#cci-darkGrad)"/>

        <rect x="400" y="345" width="100" height="40" rx="5" fill="#555A60" stroke="#333" strokeWidth="2"/>
        <rect x="405" y="350" width="90" height="30" rx="3" fill="#777E85"/>
        <rect x="515" y="345" width="80" height="42" rx="4" fill="#333" stroke="#222" strokeWidth="2"/>

        <rect x="250" y="335" width="130" height="50" fill="#2B2D30" stroke="#1F2022" strokeWidth="2"/>
        <rect x="255" y="340" width="120" height="40" fill="#3D4045"/>
        <line x1="260" y1="350" x2="370" y2="350" stroke="#222" strokeWidth="2"/>
        <line x1="260" y1="360" x2="370" y2="360" stroke="#222" strokeWidth="2"/>
        <line x1="260" y1="370" x2="370" y2="370" stroke="#222" strokeWidth="2"/>

        <path d="M 240,350 A 75,75 0 0,1 400,350 L 380,350 A 55,55 0 0,0 260,350 Z" fill="#1A1A1A"/>
        <path d="M 600,350 A 75,75 0 0,1 760,350 L 740,350 A 55,55 0 0,0 620,350 Z" fill="#1A1A1A"/>

        <path d="M 235,340 Q 240,280 320,280 Q 400,280 405,340 L 385,340 Q 380,298 320,298 Q 260,298 255,340 Z" fill="#222"/>
        <path d="M 580,340 Q 585,270 665,270 Q 745,270 750,340 L 730,340 Q 725,288 665,288 Q 605,288 600,340 Z" fill="#222"/>

        <rect x="190" y="180" width="384" height="160" fill="url(#cci-yellowGrad)"/>
        <path d="M 190,180 L 574,180 L 574,165 L 205,165 Z" fill="url(#cci-yellowGrad)"/>

        {/* Área amarela livre da carroceria — número do CCI em preto. Moldura vai até
            em cima do corpo, antes da sombra do teto começar. */}
        <rect x="330" y="182" width="240" height="148" fill="#E6B800" opacity="0.3" rx="2"/>
        <rect x="335" y="184" width="230" height="141" fill="url(#cci-yellowGrad)" rx="2"/>
        {/* Vincos ondulados na lataria — cada crista alterna sombra em cima/embaixo,
            igual à sugestão da parte amarela do topo (linha clara + linha escura
            trocando de lado a cada vinco). */}
        <rect x="335" y="196" width="230" height="1.5" fill="#000" opacity="0.12"/>
        <rect x="335" y="197.5" width="230" height="1.5" fill="#FFF" opacity="0.25"/>

        <rect x="335" y="222" width="230" height="1.5" fill="#FFF" opacity="0.25"/>
        <rect x="335" y="223.5" width="230" height="1.5" fill="#000" opacity="0.12"/>

        <rect x="335" y="248" width="230" height="1.5" fill="#000" opacity="0.12"/>
        <rect x="335" y="249.5" width="230" height="1.5" fill="#FFF" opacity="0.25"/>

        <rect x="335" y="274" width="230" height="1.5" fill="#FFF" opacity="0.25"/>
        <rect x="335" y="275.5" width="230" height="1.5" fill="#000" opacity="0.12"/>

        <rect x="335" y="300" width="230" height="1.5" fill="#000" opacity="0.12"/>
        <rect x="335" y="301.5" width="230" height="1.5" fill="#FFF" opacity="0.25"/>

        {/* Sombra leve geral na moldura */}
        <rect x="335" y="184" width="230" height="141" fill="#000" opacity="0.04" rx="2"/>
        {numero && (
          <text x="450" y="280" fontFamily="Arial, sans-serif" fontWeight="bold" fontSize="100"
            fill="#000000" textAnchor="middle">
            {String(numero).padStart(2, '0')}
          </text>
        )}

        {/* Faixa vermelha na traseira também, exceto dentro da moldura do número */}
        <rect x="190" y="240" width="140" height="30" fill="#D32F2F"/>
        <rect x="570" y="240" width="4" height="30" fill="#D32F2F"/>

        {/* Porta do compartimento — sobrepondo a faixa vermelha */}
        <rect x="200" y="190" width="68" height="106" fill="url(#cci-metalGrad)" stroke="#888" strokeWidth="2" rx="2"/>
        <rect x="200" y="190" width="68" height="106" fill="url(#cci-shutterPattern)"/>
        <rect x="222" y="283" width="25" height="6" fill="#333" rx="2"/>

        {/* Separação entre a porta e o fim da faixa vermelha — igual à da cabine/carroceria, só que da caixa de rodas pra cima */}
        <rect x="298" y="165" width="4" height="133" fill="#2A2D30"/>

        <g id="cci-reflectiveTape">
          <rect x="190" y="332" width="384" height="8" fill="#FFF" stroke="#CCC" strokeWidth="0.5"/>
          <path d="M 200,332 L 210,332 L 202,340 L 192,340 Z" fill="#D32F2F"/>
          <path d="M 240,332 L 250,332 L 242,340 L 232,340 Z" fill="#D32F2F"/>
          <path d="M 270,332 L 280,332 L 272,340 L 262,340 Z" fill="#D32F2F"/>
          <path d="M 300,332 L 310,332 L 302,340 L 292,340 Z" fill="#D32F2F"/>
          <path d="M 330,332 L 340,332 L 332,340 L 322,340 Z" fill="#D32F2F"/>
          <path d="M 360,332 L 370,332 L 362,340 L 352,340 Z" fill="#D32F2F"/>
          <path d="M 390,332 L 400,332 L 392,340 L 382,340 Z" fill="#D32F2F"/>
          <path d="M 420,332 L 430,332 L 422,340 L 412,340 Z" fill="#D32F2F"/>
          <path d="M 450,332 L 460,332 L 452,340 L 442,340 Z" fill="#D32F2F"/>
          <path d="M 480,332 L 490,332 L 482,340 L 472,340 Z" fill="#D32F2F"/>
          <path d="M 510,332 L 520,332 L 512,340 L 502,340 Z" fill="#D32F2F"/>
          <path d="M 540,332 L 550,332 L 542,340 L 532,340 Z" fill="#D32F2F"/>
          <path d="M 570,332 L 580,332 L 572,340 L 562,340 Z" fill="#D32F2F"/>
        </g>

        <rect x="240" y="155" width="330" height="10" fill="#B0B0B0"/>
        <line x1="250" y1="165" x2="250" y2="155" stroke="#777" strokeWidth="3"/>
        <line x1="350" y1="165" x2="350" y2="155" stroke="#777" strokeWidth="3"/>
        <line x1="450" y1="165" x2="450" y2="155" stroke="#777" strokeWidth="3"/>
        <line x1="550" y1="165" x2="550" y2="155" stroke="#777" strokeWidth="3"/>
        <rect x="260" y="148" width="120" height="8" rx="3" fill="#D0D0D0" stroke="#999"/>

        {/* Vão fino entre a cabine e a carroceria (chassi preto embaixo continua contínuo) */}
        <rect x="574" y="165" width="10" height="175" fill="#2A2D30"/>

        {/* Cabine — quadrada */}
        <rect x="584" y="170" width="176" height="170" fill="url(#cci-yellowGrad)"/>

        {/* Faixa vermelha — só na cabine */}
        <rect x="584" y="240" width="176" height="30" fill="#D32F2F"/>

        <path d="M 590,180 L 640,180 L 640,230 L 590,230 Z" fill="url(#cci-glassGrad)" stroke="#222" strokeWidth="2"/>
        <rect x="656" y="180" width="75" height="50" fill="url(#cci-glassGrad)" stroke="#222" strokeWidth="2"/>
        <line x1="648" y1="175" x2="648" y2="235" stroke="#1A1A1A" strokeWidth="4"/>

        <path d="M 648,175 L 648,320" stroke="#B89600" strokeWidth="1.5"/>
        {/* Abridor de porta — só o da frente, cabine simples (não dupla) */}
        <rect x="667" y="242" width="12" height="6" rx="1" fill="#222"/>

        {/* Beirada lateral do para-brisas da frente — alinhada com a linha da frente, mesma cor do vidro da porta, sem borda à direita */}
        <rect x="753" y="176" width="9" height="58" fill="url(#cci-glassGrad)"/>
        <path d="M 753,176 L 753,234 M 753,176 L 762,176 M 753,234 L 762,234" stroke="#222" strokeWidth="2" fill="none"/>

        {/* Retrovisor — haste começa um pouco atrás do final da beirada do para-brisas
            e vai da frente pra trás; hastes ficam à direita do espelho; segunda
            haste embaixo */}
        <path d="M 752,203 L 738,199" stroke="#1A1A1A" strokeWidth="3"/>
        <path d="M 752,215 L 738,219" stroke="#1A1A1A" strokeWidth="3"/>
        <rect x="722" y="192" width="18" height="30" fill="#1A1A1A" stroke="#000" strokeWidth="1"/>

        <rect x="660" y="325" width="60" height="6" fill="#111"/>
        <rect x="665" y="333" width="50" height="6" fill="#111"/>

        <path d="M 755,230 L 765,245 L 765,320 L 755,335 Z" fill="#2A2D30"/>
        <line x1="756" y1="260" x2="766" y2="260" stroke="#555" strokeWidth="2"/>
        <line x1="756" y1="275" x2="766" y2="275" stroke="#555" strokeWidth="2"/>
        <line x1="756" y1="290" x2="766" y2="290" stroke="#555" strokeWidth="2"/>

        {/* Para-choque dianteiro — parte de baixo em ângulo "/" (como o chassi traseiro, espelhado) */}
        <polygon points="745,325 785,325 785,350 745,370" fill="url(#cci-darkGrad)"/>
        {/* Farol — retangular único, atrás do canhão de para-choque; laranja ocupa metade
            inferior da altura, branco completa o restante (parte de cima) do mesmo retângulo;
            parte de trás (esquerda) com ângulo "\" sutil */}
        <polygon points="743,300 762,300 762,318 740,318" fill="#FFF"/>
        <polygon points="741.5,309 762,309 762,318 740,318" fill="#FF9900"/>

        {/* Luz vermelha do teto da cabine — igual à cor da traseira, mais estreita e um pouco mais alta, colada na borda da cabine */}
        <rect x="663" y="159" width="15" height="11" rx="2" fill="#FF0000"/>
        <rect x="665" y="157" width="11" height="3" rx="1" fill="#D32F2F"/>
        {/* Objeto vermelho do teto acima da porta do compartimento traseiro — mais pra trás */}
        <rect x="215" y="157" width="15" height="8" rx="2" fill="#FF0000"/>

        {/* Canhão de teto — cinza escuro, colado na borda superior da cabine */}
        <rect x="680" y="155" width="30" height="15" fill="#333" rx="2"/>
        <rect x="690" y="140" width="10" height="15" fill="#555"/>
        <circle cx="695" cy="135" r="8" fill="#3A3D40" stroke="#1A1C1E" strokeWidth="1"/>
        <path d="M 695,135 L 725,130" stroke="#3A3D40" strokeWidth="8" strokeLinecap="round"/>
        <path d="M 725,130 L 745,130" stroke="#3A3D40" strokeWidth="6"/>
        <path d="M 745,126 L 758,124 L 758,136 L 745,134 Z" fill="#222"/>
        <rect x="720" y="123" width="4" height="14" fill="#FFF"/>

        {/* Canhão de para-choque — cinza escuro, mais curto, base mais pra trás, saindo de cima do para-choque */}
        <rect x="772" y="312" width="18" height="14" fill="#222"/>
        <path d="M 786,318 L 797,318" stroke="#3A3D40" strokeWidth="6"/>
        <circle cx="797" cy="318" r="5" fill="#3A3D40" stroke="#1A1C1E" strokeWidth="1"/>
        <path d="M 797,318 L 812,318" stroke="#3A3D40" strokeWidth="5"/>
        <path d="M 812,314 L 820,312 L 820,324 L 812,322 Z" fill="#111"/>

        <g id="cci-rearWheel">
          <circle cx="320" cy="350" r="62" fill="url(#cci-tireGrad)"/>
          <path d="M 320,288 L 320,296 M 320,404 L 320,412 M 258,350 L 266,350 M 374,350 L 382,350" stroke="#111" strokeWidth="4"/>
          <path d="M 276,306 L 282,312 M 358,388 L 364,394 M 276,394 L 282,388 M 358,312 L 364,306" stroke="#111" strokeWidth="4"/>
          <circle cx="320" cy="350" r="40" fill="url(#cci-wheelGrad)" stroke="#222" strokeWidth="2"/>
          <circle cx="320" cy="350" r="28" fill="#1A1A1A"/>
          <circle cx="320" cy="350" r="18" fill="url(#cci-wheelGrad)"/>
          <circle cx="320" cy="350" r="8" fill="#111"/>
          <circle cx="320" cy="336" r="2" fill="#FFF"/>
          <circle cx="334" cy="350" r="2" fill="#FFF"/>
          <circle cx="320" cy="364" r="2" fill="#FFF"/>
          <circle cx="306" cy="350" r="2" fill="#FFF"/>
          <circle cx="310" cy="340" r="2" fill="#FFF"/>
          <circle cx="330" cy="340" r="2" fill="#FFF"/>
          <circle cx="310" cy="360" r="2" fill="#FFF"/>
          <circle cx="330" cy="360" r="2" fill="#FFF"/>
        </g>

        <g id="cci-frontWheel">
          <circle cx="665" cy="350" r="62" fill="url(#cci-tireGrad)"/>
          <path d="M 665,288 L 665,296 M 665,404 L 665,412 M 603,350 L 611,350 M 719,350 L 727,350" stroke="#111" strokeWidth="4"/>
          <path d="M 621,306 L 627,312 M 703,388 L 709,394 M 621,394 L 627,388 M 703,312 L 709,306" stroke="#111" strokeWidth="4"/>
          <circle cx="665" cy="350" r="40" fill="url(#cci-wheelGrad)" stroke="#222" strokeWidth="2"/>
          <circle cx="665" cy="350" r="28" fill="#1A1A1A"/>
          <circle cx="665" cy="350" r="18" fill="url(#cci-wheelGrad)"/>
          <circle cx="665" cy="350" r="8" fill="#111"/>
          <circle cx="665" cy="336" r="2" fill="#FFF"/>
          <circle cx="679" cy="350" r="2" fill="#FFF"/>
          <circle cx="665" cy="364" r="2" fill="#FFF"/>
          <circle cx="651" cy="350" r="2" fill="#FFF"/>
          <circle cx="655" cy="340" r="2" fill="#FFF"/>
          <circle cx="675" cy="340" r="2" fill="#FFF"/>
          <circle cx="655" cy="360" r="2" fill="#FFF"/>
          <circle cx="675" cy="360" r="2" fill="#FFF"/>
        </g>

        <rect x="200" y="320" width="8" height="4" fill="#FF9900" rx="1"/>
        <rect x="565" y="320" width="8" height="4" fill="#FF9900" rx="1"/>
        <rect x="745" y="315" width="8" height="4" fill="#FF9900" rx="1"/>

        <text x="758" y="252" fontFamily="Arial, sans-serif" fontWeight="bold" fontSize="7" fill="#FFF" opacity="0.8">SCANIA</text>
      </g>
    </svg>
  )
}
