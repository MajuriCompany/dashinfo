import { useState, useEffect, useCallback } from 'react'
import { fetchAllOffersData, invalidateCache } from '../services/sheetsService'
import { fetchAndCacheRates, makeGetRate } from '../services/exchangeRateService'
import { enrichRow } from '../utils/calculations'

export function useSheetData(offers, settings, apiKey, buyersApiKey = '') {
  const [data, setData]       = useState({})
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)

  const load = useCallback(async (invalidate = false) => {
    if (!apiKey || offers.length === 0) return
    setLoading(true)
    setError(null)
    if (invalidate) invalidateCache()

    try {
      const ratesMap    = await fetchAndCacheRates()
      const getRateForDate = makeGetRate(ratesMap, settings.usdRate)

      const raw = await fetchAllOffersData(offers, apiKey, getRateForDate, buyersApiKey)
      const enriched = {}
      for (const [id, rows] of Object.entries(raw)) {
        enriched[id] = rows.map(r => enrichRow(r, settings.aliquota))
      }
      setData(enriched)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [offers, settings.usdRate, settings.aliquota, apiKey, buyersApiKey])

  useEffect(() => {
    load(true)
    const interval = setInterval(() => load(true), 10 * 60 * 1000)
    return () => clearInterval(interval)
  }, [load])

  const refresh = useCallback(() => load(true), [load])

  return { data, loading, error, refresh }
}
