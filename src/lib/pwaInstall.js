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
  // O evento pode já ter sido capturado antes de este componente montar
  // (ver script inline em index.html) — usa ele como valor inicial.
  const [evento, setEvento] = useState(() => window.__deferredInstallPrompt || null)

  useEffect(() => {
    if (window.__deferredInstallPrompt && !evento) setEvento(window.__deferredInstallPrompt)

    function handler(e) {
      e.preventDefault()
      window.__deferredInstallPrompt = e
      setEvento(e)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function instalar() {
    if (!evento) return false
    evento.prompt()
    const { outcome } = await evento.userChoice
    window.__deferredInstallPrompt = null
    setEvento(null)
    return outcome === 'accepted'
  }

  return { podeInstalar: !!evento, instalar }
}

export function isIOS() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent) && !window.MSStream
}
