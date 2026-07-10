import { listarFila, removerDaFila } from './offlineQueue'
import { HANDLERS_FILA, isErroDeRede } from './queries'

let sincronizando = false

export async function sincronizarFila() {
  if (sincronizando || !navigator.onLine) return
  sincronizando = true
  try {
    const itens = (await listarFila()).sort((a, b) => a.id - b.id)
    for (const item of itens) {
      const handler = HANDLERS_FILA[item.tipo]
      if (!handler) {
        // tipo desconhecido (ex: versão antiga do app) — não tem como reprocessar
        await removerDaFila(item.id)
        continue
      }
      try {
        await handler(item.args)
        await removerDaFila(item.id)
      } catch (err) {
        if (isErroDeRede(err)) break // ainda sem rede — tenta o resto na próxima vez
        console.error('Falha ao sincronizar item da fila offline, descartando:', item, err)
        await removerDaFila(item.id)
      }
    }
  } finally {
    sincronizando = false
  }
}

export function iniciarSyncOffline() {
  window.addEventListener('online', sincronizarFila)
  window.addEventListener('focus', sincronizarFila)
  sincronizarFila()
  setInterval(sincronizarFila, 30000)
}
