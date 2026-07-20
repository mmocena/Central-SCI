import { useEffect, useState } from 'react'

// true quando o app já está rodando "instalado" (sem chrome do navegador) —
// tanto no padrão (display-mode: standalone) quanto no caso específico do
// Safari/iOS (navigator.standalone).
export function useInstalado() {
  const [instalado, setInstalado] = useState(() =>
    window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true
  )
  useEffect(() => {
    const mq = window.matchMedia('(display-mode: standalone)')
    const handler = () => setInstalado(mq.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  return instalado
}

// Captura o evento beforeinstallprompt (Chrome/Android e derivados) — só
// dispara quando o navegador considera o site instalável (manifest válido,
// ícones corretos, service worker registrado). Sem suporte no Safari/iOS.
export function useInstallPrompt() {
  const [evento, setEvento] = useState(null)

  useEffect(() => {
    function handler(e) {
      e.preventDefault()
      setEvento(e)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  async function instalar() {
    if (!evento) return false
    evento.prompt()
    const { outcome } = await evento.userChoice
    setEvento(null)
    return outcome === 'accepted'
  }

  return { podeInstalar: !!evento, instalar }
}

export function isIOS() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent) && !window.MSStream
}
