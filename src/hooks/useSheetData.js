import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { fetchAllOffersData, invalidateCache } from '../services/sheetsService'
import { fetchAndCacheRates, makeGetRate } from '../services/exchangeRateService'
import { enrichRow } from '../utils/calculations'

const REFRESH_EVERY = 10 * 60 * 1000

// Store compartilhado entre as páginas (fica fora do componente) — trocar de aba
// não refaz a busca; só o auto-refresh (10 min) e o botão "Atualizar dados".
// Uma entrada por configuração (ofertas + cotação + alíquota + chaves).
const stores = new Map()

function getStore(key) {
  if (!stores.has(key)) {
    stores.set(key, { data: {}, productRows: {}, warnings: [], error: null, ts: 0, seq: 0, promise: null })
    // Config mudou (ex: editou oferta) — descarta entradas antigas
    while (stores.size > 3) stores.delete(stores.keys().next().value)
  }
  return stores.get(key)
}

function runLoad(store, { offers, settings, apiKey, buyersApiKey }, invalidate) {
  // Já tem busca rodando e não é refresh forçado — reaproveita
  if (store.promise && !invalidate) return store.promise

  const seq = ++store.seq
  const p = (async () => {
    if (invalidate) invalidateCache()

    const ratesMap       = await fetchAndCacheRates()
    const getRateForDate = makeGetRate(ratesMap, settings.usdRate)
    const { data: raw, productRows, failures, buyersFailed } =
      await fetchAllOffersData(offers, apiKey, getRateForDate, buyersApiKey)

    // Uma busca mais nova começou enquanto essa rodava — descarta resultado velho
    if (seq !== store.seq) return

    const data     = {}
    const warnings = []
    if (buyersFailed) warnings.push('Planilha de compradores (faturamento/vendas)')
    const bySource = {}

    for (const offer of offers) {
      // Aba da oferta é só fallback histórico — falha nela não segura a atualização
      const failed = buyersFailed || (failures[offer.id] || []).some(f => f !== 'aba da oferta')
      const prev   = store.data[offer.id]
      // Fonte falhou e já temos dado bom dessa oferta — mantém o anterior em vez de
      // mostrar gasto zerado ou vindo da aba de fallback
      data[offer.id] = failed && prev
        ? prev
        : (raw[offer.id] || []).map(r => enrichRow(r, settings.aliquota))
      ;(failures[offer.id] || []).forEach(src => (bySource[src] ||= []).push(offer.name))
    }
    // Agrupa por fonte: "Meta: Oferta A, Oferta B" — muitas ofertas viram contagem
    for (const [src, names] of Object.entries(bySource)) {
      warnings.push(`${src}: ${names.length > 4 ? `${names.length} ofertas` : names.join(', ')}`)
    }

    store.data        = data
    store.productRows = buyersFailed && Object.keys(store.productRows).length ? store.productRows : productRows
    store.warnings    = warnings
    store.error       = null
    store.ts          = Date.now()
  })()
    .catch(e => {
      if (seq !== store.seq) return
      // Se já há dados na tela, não derruba a página — vira aviso
      if (store.ts) store.warnings = [`Falha ao atualizar: ${e.message}`]
      else store.error = e.message
    })
    .finally(() => { if (store.promise === p) store.promise = null })

  store.promise = p
  return p
}

export function useSheetData(offers, settings, apiKey, buyersApiKey = '') {
  const key = useMemo(
    () => JSON.stringify([offers, settings.usdRate, settings.aliquota, apiKey, buyersApiKey]),
    [offers, settings.usdRate, settings.aliquota, apiKey, buyersApiKey]
  )
  const store = getStore(key)

  const [loading, setLoading] = useState(() => !store.ts)
  const [, rerender]          = useState(0)
  const mounted               = useRef(true)

  const load = useCallback(async (invalidate = false) => {
    if (!apiKey || offers.length === 0) return
    const s = getStore(key)
    setLoading(true)
    await runLoad(s, { offers, settings, apiKey, buyersApiKey }, invalidate)
    if (mounted.current) {
      setLoading(!!s.promise)
      rerender(n => n + 1)
    }
  }, [key, offers, settings, apiKey, buyersApiKey])

  useEffect(() => {
    mounted.current = true
    const s = getStore(key)
    // Só busca se não tem dado ou se está velho; senão usa o que já está em memória
    if (!s.ts || Date.now() - s.ts > REFRESH_EVERY || s.promise) load(false)
    else setLoading(false)

    const interval = setInterval(() => {
      if (Date.now() - getStore(key).ts > REFRESH_EVERY) load(false)
    }, 60 * 1000)
    return () => { mounted.current = false; clearInterval(interval) }
  }, [key, load])

  const refresh = useCallback(() => load(true), [load])

  return {
    data:        store.data,
    productRows: store.productRows,
    warnings:    store.warnings,
    loading,
    error:       store.error,
    refresh,
  }
}
