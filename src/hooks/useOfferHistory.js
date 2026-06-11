import { useState, useCallback } from 'react'

const KEY = 'dash_offer_history'

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {} } catch { return {} }
}

export function useOfferHistory() {
  const [history, setHistory] = useState(load)

  const add = useCallback((offerId, { date, note }) => {
    setHistory(prev => {
      const next = {
        ...prev,
        [offerId]: [...(prev[offerId] || []), {
          id: Date.now().toString(),
          date,
          note: note.trim(),
        }]
      }
      localStorage.setItem(KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const update = useCallback((offerId, id, { date, note }) => {
    setHistory(prev => {
      const next = {
        ...prev,
        [offerId]: (prev[offerId] || []).map(e =>
          e.id !== id ? e : { ...e, date, note: note.trim() }
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
