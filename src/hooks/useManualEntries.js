import { useState, useCallback } from 'react'

const KEY = 'dash_manual_entries'

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || [] } catch { return [] }
}

export function useManualEntries() {
  const [entries, setEntries] = useState(load)

  const addEntry = useCallback((fields) => {
    setEntries(prev => {
      const next = [...prev, {
        id:              Date.now().toString(),
        date:            fields.date,           // "YYYY-MM-DD"
        offerName:       fields.offerName,
        lucro:           Number(fields.lucro),
        custoClique:     fields.custoClique     !== '' ? Number(fields.custoClique)     : null,
        custoCheckout:   fields.custoCheckout   !== '' ? Number(fields.custoCheckout)   : null,
        vendas:          fields.vendas          !== '' ? Number(fields.vendas)          : null,
        valorGasto:      fields.valorGasto      !== '' ? Number(fields.valorGasto)      : null,
      }]
      localStorage.setItem(KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const removeEntry = useCallback((id) => {
    setEntries(prev => {
      const next = prev.filter(e => e.id !== id)
      localStorage.setItem(KEY, JSON.stringify(next))
      return next
    })
  }, [])

  return { entries, addEntry, removeEntry }
}
