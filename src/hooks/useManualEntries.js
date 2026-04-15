import { useState, useCallback } from 'react'

const KEY          = 'dash_manual_entries'
const SETTINGS_KEY = 'dash_manual_offer_settings'

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || [] } catch { return [] }
}

function loadSettings() {
  try { return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {} } catch { return {} }
}

function toNum(v) {
  return v !== '' && v != null ? Number(v) : null
}

export function useManualEntries() {
  const [entries, setEntries]             = useState(load)
  const [offerSettings, setOfferSettings] = useState(loadSettings)

  const addEntry = useCallback((fields) => {
    setEntries(prev => {
      const next = [...prev, {
        id:            Date.now().toString(),
        date:          fields.date,
        offerName:     fields.offerName,
        custoClique:   toNum(fields.custoClique),
        custoCheckout: toNum(fields.custoCheckout),
        vendas:        toNum(fields.vendas),
        gasto:         toNum(fields.gasto),
        faturado:      toNum(fields.faturado),
      }]
      localStorage.setItem(KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const updateEntry = useCallback((id, fields) => {
    setEntries(prev => {
      const next = prev.map(e => e.id !== id ? e : {
        ...e,
        date:          fields.date,
        offerName:     fields.offerName,
        custoClique:   toNum(fields.custoClique),
        custoCheckout: toNum(fields.custoCheckout),
        vendas:        toNum(fields.vendas),
        gasto:         toNum(fields.gasto),
        faturado:      toNum(fields.faturado),
        // limpa campo antigo se existia
        lucro:         undefined,
        valorGasto:    undefined,
      })
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

  const setOfferIncludeDash = useCallback((offerName, include) => {
    setOfferSettings(prev => {
      const next = { ...prev, [offerName]: { ...(prev[offerName] || {}), includeInDash: include } }
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  return { entries, addEntry, updateEntry, removeEntry, offerSettings, setOfferIncludeDash }
}
