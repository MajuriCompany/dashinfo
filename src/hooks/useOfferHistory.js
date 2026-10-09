import { useState, useCallback } from 'react'

const KEY = 'dash_offer_history'

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {} } catch { return {} }
}

export function useOfferHistory() {
  const [history, setHistory] = useState(load)

  // snapshot (opcional): { start, end, days, metrics, savedAt } — métricas do período congeladas
  const add = useCallback((offerId, { date, note, snapshot }) => {
    setHistory(prev => {
      const next = {
        ...prev,
        [offerId]: [...(prev[offerId] || []), {
          id: Date.now().toString(),
          date,
          note: note.trim(),
          ...(snapshot ? { snapshot } : {}),
        }]
      }
      localStorage.setItem(KEY, JSON.stringify(next))
      return next
    })
  }, [])

  // patch parcial — ex: { date, note } na edição ou { snapshot } ao recalcular
  const update = useCallback((offerId, id, patch) => {
    setHistory(prev => {
      const next = {
        ...prev,
        [offerId]: (prev[offerId] || []).map(e =>
          e.id !== id ? e : { ...e, ...patch, ...(patch.note != null ? { note: patch.note.trim() } : {}) }
        )
      }
      localStorage.setItem(KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const remove = useCallback((offerId, id) => {
    setHistory(prev => {
      const next = {
        ...prev,
        [offerId]: (prev[offerId] || []).filter(e => e.id !== id)
      }
      localStorage.setItem(KEY, JSON.stringify(next))
      return next
    })
  }, [])

  return { history, add, update, remove }
}
