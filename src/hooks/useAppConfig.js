import { useState, useCallback, useMemo } from 'react'
import { DEFAULT_SETTINGS, DEFAULT_OFFERS } from '../config/defaultConfig'

const KEYS = {
  settings:    'dash_settings',
  offers:      'dash_offers',
  apiKey:      'dash_api_key',
  buyersApiKey: 'dash_buyers_api_key',
}

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function save(key, value) {
  localStorage.setItem(key, JSON.stringify(value))
}

export function useAppConfig() {
  const [settings, setSettingsState] = useState(() => ({
    ...DEFAULT_SETTINGS,
    ...load(KEYS.settings, {}),
  }))
  const [offers, setOffersState]     = useState(() => load(KEYS.offers, DEFAULT_OFFERS))
  const [apiKey, setApiKeyState]          = useState(() => localStorage.getItem(KEYS.apiKey)      || import.meta.env.VITE_GOOGLE_SHEETS_API_KEY || '')
  const [buyersApiKey, setBuyersApiKeyState] = useState(() => localStorage.getItem(KEYS.buyersApiKey) || '')

  const updateSettings = useCallback((patch) => {
    setSettingsState(prev => {
      const next = { ...prev, ...patch }
      save(KEYS.settings, next)
      return next
    })
  }, [])

  const saveApiKey = useCallback((key) => {
    setApiKeyState(key)
    localStorage.setItem(KEYS.apiKey, key)
  }, [])

  const saveBuyersApiKey = useCallback((key) => {
    setBuyersApiKeyState(key)
    localStorage.setItem(KEYS.buyersApiKey, key)
  }, [])

  const addOffer = useCallback((offer) => {
    setOffersState(prev => {
      const next = [...prev, offer]
      save(KEYS.offers, next)
      return next
    })
  }, [])

  const updateOffer = useCallback((id, patch) => {
    setOffersState(prev => {
      const next = prev.map(o => o.id === id ? { ...o, ...patch } : o)
      save(KEYS.offers, next)
      return next
    })
  }, [])

  const removeOffer = useCallback((id) => {
    setOffersState(prev => {
      const next = prev.filter(o => o.id !== id)
      save(KEYS.offers, next)
      return next
    })
  }, [])

  const resetDefaults = useCallback(() => {
    setSettingsState(DEFAULT_SETTINGS)
    setOffersState(DEFAULT_OFFERS)
    save(KEYS.settings, DEFAULT_SETTINGS)
    save(KEYS.offers, DEFAULT_OFFERS)
  }, [])

  return {
    settings,
    offers,
    apiKey,
    buyersApiKey,
    updateSettings,
    saveApiKey,
    saveBuyersApiKey,
    addOffer,
    updateOffer,
    removeOffer,
    resetDefaults,
    activeOffers: useMemo(() => offers.filter(o => o.status === 'active'), [offers]),
  }
}
