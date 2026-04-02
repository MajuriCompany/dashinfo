// ---------------------------------------------------------------------------
// Cotação diária USD/BRL — AwesomeAPI (sem chave de API)
// Cache em localStorage: { "2026-04-01": 5.20, ... }
// Regra: gasto Meta do dia D usa o fechamento do dia D
//        (para hoje sem fechamento, usa D-1 — closest anterior)
// ---------------------------------------------------------------------------

const LS_KEY   = 'dash_usd_rates'
const LS_FETCH = 'dash_usd_rates_fetched' // data da última busca (YYYY-MM-DD)
const API_URL  = 'https://economia.awesomeapi.com.br/json/daily/USD-BRL/90'

function today() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function loadCached() {
  try { return JSON.parse(localStorage.getItem(LS_KEY)) || {} } catch { return {} }
}

function saveCached(rates) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(rates)) } catch {}
}

// Busca da API e mescla com cache. Só busca 1x por dia.
export async function fetchAndCacheRates() {
  const lastFetch = localStorage.getItem(LS_FETCH)
  const todayStr  = today()

  if (lastFetch === todayStr) {
    return loadCached()
  }

  try {
    const res  = await fetch(API_URL)
    if (!res.ok) throw new Error(`AwesomeAPI ${res.status}`)
    const json = await res.json()

    const existing = loadCached()

    for (const entry of json) {
      // create_date: "2026-04-01 17:59:59"
      const dateKey = String(entry.create_date || '').slice(0, 10)
      if (!dateKey) continue
      const rate = parseFloat(entry.bid)
      if (!isNaN(rate) && rate > 0) existing[dateKey] = rate
    }

    saveCached(existing)
    localStorage.setItem(LS_FETCH, todayStr)
    console.log(`[USD] ✅ Cotações carregadas: ${Object.keys(existing).length} dias. Hoje: ${existing[todayStr] || 'sem fechamento'}`)
    return existing
  } catch (e) {
    console.warn('[USD] Falha ao buscar cotações:', e.message)
    return loadCached()
  }
}

// Retorna a cotação para uma data (YYYY-MM-DD).
// Se não há taxa exata, usa o dia anterior mais próximo.
// Fallback final: valor manual do settings.
export function makeGetRate(ratesMap, fallbackRate) {
  const sortedDates = Object.keys(ratesMap).sort()

  return function getRateForDate(dateKey) {
    if (ratesMap[dateKey]) return ratesMap[dateKey]

    // Busca o dia anterior mais próximo
    let closest = null
    for (const d of sortedDates) {
      if (d <= dateKey) closest = d
      else break
    }
    if (closest) return ratesMap[closest]

    return fallbackRate
  }
}
