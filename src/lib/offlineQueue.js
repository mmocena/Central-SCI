import { useEffect, useState } from 'react'

const DB_NAME = 'central-sci-offline'
const STORE = 'fila'

function reqPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function abrirDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

// pub-sub simples pra UI reagir sem reabrir o IndexedDB a cada poucos segundos
const ouvintes = new Set()
function notificar() { ouvintes.forEach(fn => fn()) }
export function ouvirFila(fn) { ouvintes.add(fn); return () => ouvintes.delete(fn) }

export async function enfileirar(tipo, args) {
  const db = await abrirDB()
  const tx = db.transaction(STORE, 'readwrite')
  const id = await reqPromise(tx.objectStore(STORE).add({ tipo, args, criadoEm: Date.now() }))
  notificar()
  return id
}

export async function listarFila() {
  const db = await abrirDB()
  const tx = db.transaction(STORE, 'readonly')
  return reqPromise(tx.objectStore(STORE).getAll())
}

export async function removerDaFila(id) {
  const db = await abrirDB()
  const tx = db.transaction(STORE, 'readwrite')
  await reqPromise(tx.objectStore(STORE).delete(id))
  notificar()
}

export async function contarFila() {
  const db = await abrirDB()
  const tx = db.transaction(STORE, 'readonly')
  return reqPromise(tx.objectStore(STORE).count())
}

export function useFilaOffline() {
  const [count, setCount] = useState(0)

  useEffect(() => {
    let ativo = true
    async function atualizar() {
      const n = await contarFila()
      if (ativo) setCount(n)
    }
    atualizar()
    return ouvirFila(atualizar)
  }, [])

  return count
}
