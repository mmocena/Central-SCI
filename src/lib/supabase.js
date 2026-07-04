import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

// Sinal fraco em campo derruba o fetch com TypeError ("Load failed" / "Failed to fetch")
// antes mesmo de chegar ao servidor. Retenta com backoff em vez de perder o registro.
async function fetchComRetentativa(input, init, tentativas = 3) {
  for (let i = 0; i < tentativas; i++) {
    try {
      return await fetch(input, init)
    } catch (err) {
      if (i === tentativas - 1) throw err
      await new Promise(r => setTimeout(r, 500 * 2 ** i))
    }
  }
}

export const supabase = createClient(url, key, {
  realtime: { params: { eventsPerSecond: 10 } },
  global: { fetch: fetchComRetentativa }
})
