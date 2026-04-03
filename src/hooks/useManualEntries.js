import { useState, useCallback } from 'react'

const KEY = 'dash_manual_entries'

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || [] } catch { return [] }
}

export function useManualEntries() {
  const [entries, setEntries] = useState(load)

  const addEntry = useCallback((date, offerName, lucro) => {
    setEntries(prev => {
      const next = [...prev, {
        id:        Date.now().toString(),
        date,       // "YYYY-MM-DD"
        offerName,
        lucro:     Number(lucro),
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
