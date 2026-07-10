import { describe, it, expect } from 'vitest'
import { isErroDeRede } from './queries'

describe('isErroDeRede', () => {
  it('reconhece um TypeError bruto do fetch', () => {
    expect(isErroDeRede(new TypeError('Failed to fetch'))).toBe(true)
    expect(isErroDeRede(new TypeError('Load failed'))).toBe(true)
  })

  it('reconhece o erro embrulhado pelo supabase-js/postgrest-js', () => {
    // supabase-js não deixa o TypeError escapar puro — embrulha em
    // { message, details, code }, por isso a checagem de texto é necessária.
    expect(isErroDeRede({ message: 'TypeError: Failed to fetch', details: '...', code: '' })).toBe(true)
    expect(isErroDeRede({ message: '', details: 'TypeError: Load failed\n    at ...', code: '' })).toBe(true)
  })

  it('não confunde um erro de dados real com erro de rede', () => {
    expect(isErroDeRede({ message: 'duplicate key value violates unique constraint', code: '23505' })).toBe(false)
    expect(isErroDeRede(new Error('validation failed'))).toBe(false)
  })

  it('lida com valores nulos/indefinidos sem quebrar', () => {
    expect(isErroDeRede(null)).toBe(false)
    expect(isErroDeRede(undefined)).toBe(false)
    expect(isErroDeRede({})).toBe(false)
  })
})
