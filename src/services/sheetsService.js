import { parseDate, parseNum } from '../utils/dateUtils'
import { RESULTADO_GERAL_ID } from '../config/defaultConfig'

const BASE = 'https://sheets.googleapis.com/v4/spreadsheets'
const cache = new Map()
const CACHE_TTL = 10 * 60 * 1000
// Erros transitórios (timeout, instabilidade de rede, rate limit, falha temporária do Google) — vale tentar de novo.
// Erros de configuração (planilha/range/permissão errados) não se resolvem com retry.
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504])

class NonRetryableError extends Error {}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function fetchWithTimeout(url, ms = 15000) {
  const ctrl = new AbortController()
  const id   = setTimeout(() => ctrl.abort(), ms)
  return fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(id))
}

// Limita chamadas simultâneas ao Google — disparar ~20 de uma vez estoura a cota por minuto (429).
const MAX_CONCURRENT = 4
let active = 0
const queue = []

// Cota da API key: 60 leituras/min. Mantém margem — nunca passa de MAX_PER_MINUTE na janela de 60s.
const MAX_PER_MINUTE = 50
const sentAt = []

async function waitForQuota() {
  for (;;) {
    const now = Date.now()
    while (sentAt.length && now - sentAt[0] >= 60_000) sentAt.shift()
    if (sentAt.length < MAX_PER_MINUTE) { sentAt.push(now); return }
    await sleep(60_000 - (now - sentAt[0]) + 50)
  }
}

async function withSlot(fn) {
  if (active >= MAX_CONCURRENT) await new Promise(resolve => queue.push(resolve))
  active++
  try {
    await waitForQuota()
    return await fn()
  } finally {
    active--
    queue.shift()?.()
  }
}

// GET com retry/backoff. Cota estourada (429) zera por minuto — esperas maiores (2s, 4s, 8s, 16s).
async function requestJson(url, label, attempts = 5) {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    let status = 0
    try {
      const res = await withSlot(() => fetchWithTimeout(url))
      status = res.status
      if (!res.ok) {
        const msg = `Sheets API ${res.status}: ${res.statusText}`
        throw RETRYABLE_STATUS.has(res.status) ? new Error(msg) : new NonRetryableError(msg)
      }
      return await res.json()
    } catch (e) {
      const isLastAttempt = attempt === attempts
      if (e instanceof NonRetryableError || isLastAttempt) throw e
      const base  = status === 429 ? 2000 : 800
      const delay = base * 2 ** (attempt - 1) + Math.random() * 500
      console.warn(`[SHEETS] tentativa ${attempt} falhou (${e.message}), tentando de novo em ${Math.round(delay)}ms...`, label)
      await sleep(delay)
    }
  }
}

// Requisições em andamento — se duas partes do app pedem o mesmo range, compartilham a mesma busca.
const inflight = new Map()
// Último valor bom de cada range (não expira) — usado se uma atualização falhar
const lastGood = new Map()

function fetchRange(sheetId, range, apiKey) {
  const key = `${sheetId}||${range}`
  const cached = cache.get(key)
  if (cached && Date.now() - cached.ts < CACHE_TTL) return Promise.resolve(cached.data)
  if (inflight.has(key)) return inflight.get(key)

  // Only encode spaces — keep ' and ! literal (needed for Sheets range syntax)
  const url = `${BASE}/${sheetId}/values/${range.replace(/ /g, '%20')}?key=${apiKey}&valueRenderOption=FORMATTED_VALUE`
  const p = requestJson(url, `${sheetId} ${range}`)
    .then(json => storeRange(key, json.values || []))
    .catch(e => {
      if (lastGood.has(key)) {
        console.warn(`[SHEETS] usando último valor bom de ${range} (${e.message})`)
        return lastGood.get(key)
      }
      throw e
    })
    .finally(() => inflight.delete(key))
  inflight.set(key, p)
  return p
}

function storeRange(key, data) {
  cache.set(key, { data, ts: Date.now() })
  lastGood.set(key, data)
  return data
}

// Busca vários ranges da MESMA planilha numa única leitura (values:batchGet = 1 da cota).
// Só pré-aquece o cache — se falhar (ex: um nome de aba errado), os fetchRange individuais
// tentam cada range separado depois.
async function prefetchBatch(sheetId, ranges, apiKey) {
  const missing = [...new Set(ranges)].filter(r => {
    const c = cache.get(`${sheetId}||${r}`)
    return !(c && Date.now() - c.ts < CACHE_TTL)
  })
  if (missing.length < 2) return

  const qs  = missing.map(r => `ranges=${encodeURIComponent(r)}`).join('&')
  const url = `${BASE}/${sheetId}/values:batchGet?key=${apiKey}&valueRenderOption=FORMATTED_VALUE&${qs}`
  const p   = requestJson(url, `${sheetId} batch(${missing.length})`)
    .then(json => {
      ;(json.valueRanges || []).forEach((vr, i) => storeRange(`${sheetId}||${missing[i]}`, vr.values || []))
    })
  try { await p } catch (e) {
    console.warn(`[SHEETS] batch falhou (${e.message}) — buscando abas uma a uma`, sheetId)
  }
}

export function invalidateCache() { cache.clear() }  // in-flight continuam válidas

export async function listSheetNames(sheetId, apiKey) {
  const url = `${BASE}/${sheetId}?key=${apiKey}&fields=sheets.properties.title`
  const res = await fetch(url)
  const json = await res.json()
  return (json.sheets || []).map(s => s.properties.title)
}

// ---------------------------------------------------------------------------
// META ADS — cabeçalho confirmado pelo usuário:
// Campaign Name | Ad Set Name | Ad Name | CPC (Cost per Link Click) | Link Clicks |
// Landing Page Views | Cost per Landing Page View | Checkouts Initiated |
// Cost per Checkout Initiated | Purchases | Cost per Purchase | Amount Spent | Day
//
// Regras:
// 1. Lê cabeçalho da LINHA 1 para achar os índices das colunas
// 2. Agrupa por Day, somando Amount Spent, Link Clicks, Checkouts Initiated
// 3. Todos os valores estão em USD
// 4. CPC e CPI serão calculados APÓS conversão para BRL
// ---------------------------------------------------------------------------
export function parseMetaRows(rawRows, campaignFilter = null) {
  if (!rawRows || rawRows.length < 2) return []

  // Linha 1 = cabeçalho (índice 0)
  const header = rawRows[0].map(h => String(h || '').trim())
  console.log('[META] cabeçalhos:', header)

  // Busca pelo nome exato (case-insensitive)
  const col = (name) => header.findIndex(h => h.toLowerCase() === name.toLowerCase())

  const iDay       = col('Day')
  const iSpent     = col('Amount Spent')
  const iClicks    = col('Link Clicks')
  const iCheckouts = col('Checkouts Initiated')
  const iLPViews   = col('Landing Page Views')
  const iPurchases = col('Purchases')
  const iCampaign  = col('Campaign name')

  console.log(`[META] Day:${iDay} AmountSpent:${iSpent} Clicks:${iClicks} Checkouts:${iCheckouts} LPViews:${iLPViews} Purchases:${iPurchases} Campaign:${iCampaign}`)
  if (campaignFilter) console.log('[META] Filtro de campanha:', campaignFilter)

  if (iDay < 0 || iSpent < 0) {
    console.error('[META] ❌ Colunas "Day" ou "Amount Spent" não encontradas no cabeçalho:', header)
    return []
  }

  const byDay = {}

  for (let i = 1; i < rawRows.length; i++) {
    const row = rawRows[i]
    if (!row || !row[iDay]) continue

    // Filtro por nome de campanha (substring, case-insensitive)
    if (campaignFilter && campaignFilter.length > 0 && iCampaign >= 0) {
      const name = String(row[iCampaign] || '').toLowerCase()
      if (!campaignFilter.some(f => name.includes(f))) continue
    }

    const date = parseDate(row[iDay])
    if (!date || isNaN(date.getTime())) continue

    const key = date.toISOString().split('T')[0]
    if (!byDay[key]) {
      byDay[key] = { date, spent_usd: 0, clicks: 0, lp_views: 0, checkouts: 0 }
    }

    byDay[key].spent_usd += parseNum(row[iSpent] ?? 0)
    byDay[key].clicks    += parseNum(iClicks    >= 0 ? row[iClicks]    : 0)
    byDay[key].lp_views  += parseNum(iLPViews   >= 0 ? row[iLPViews]  : 0)
    byDay[key].checkouts += parseNum(iCheckouts >= 0 ? row[iCheckouts] : 0)
  }

  const result = Object.values(byDay).sort((a, b) => a.date - b.date)
  console.log(`[META] ✅ ${result.length} dias | USD total: $${result.reduce((s,r) => s + r.spent_usd, 0).toFixed(2)}`)
  return result
}

// ---------------------------------------------------------------------------
// ABA DA OFERTA — fallback para gasto e faturamento histórico
// Colunas: Dia | Valor Gasto | CPC | CPV | LP->IC | CPI | Conv% | Vendas | Faturamento | ...
// Gasto em BRL. CPC/CPI em USD (IGNORADOS — recalculamos do Meta convertido).
// ---------------------------------------------------------------------------
export function parseOfferResultRows(rawRows) {
  if (!rawRows || rawRows.length < 2) return []
  const results = []
  const skipWords = ['dia', 'day', 'data', 'fecha', 'total', 'mes', 'mês', 'semana', 'subtotal']

  for (const row of rawRows) {
    const col0 = String(row[0] || '').trim().toLowerCase()
    if (!col0) continue
    if (skipWords.some(w => col0 === w || col0.startsWith(w + ' ') || col0.startsWith(w + '/'))) continue

    const date = parseDate(row[0])
    if (!date || isNaN(date.getTime())) continue

    results.push({
      date,
      gasto_brl:   parseNum(row[1] ?? 0),  // Valor Gasto em BRL
      vendas:      parseNum(row[7] ?? 0),  // Qtd vendas
      fat_brl:     parseNum(row[8] ?? 0),  // Faturamento em BRL (fallback)
      // Colunas [2..6] = CPC, CPV, LP->IC, CPI, Conv% — em USD/decimal, NÃO usadas
    })
  }
  console.log(`[OFERTA] ✅ ${results.length} linhas | Ex: ${results[0] ? JSON.stringify(results[0]) : 'vazio'}`)
  return results
}

// ---------------------------------------------------------------------------
// TODOS OS COMPRADORES — faturamento por oferta por dia
//
// Colunas confirmadas: [0] Dia | [1] Nome | [2] Telefone | [3] produto |
//                      [4] Id compra | [5] Valor comissão | [6] Valor Bruto Total
//
// Só considera vendas a partir de 31/03/2026 (dados anteriores ignorados).
// Valores em BRL com vírgula decimal (ex: "75,98" ou "1.500,00")
// ---------------------------------------------------------------------------
const BUYERS_CUTOFF = new Date(2026, 2, 31) // 31/03/2026 horário local

export async function fetchBuyersDataByOffer(buyersApiKey, offers) {
  const rows = await fetchRange(RESULTADO_GERAL_ID, "'todos compradores'!A:Z", buyersApiKey)
  if (!rows || rows.length < 2) {
    console.warn('[COMPRADORES] Aba vazia ou sem dados')
    return { byOffer: {}, rawRows: {} }
  }

  const header = rows[0].map(h => String(h || '').trim())
  console.log('[COMPRADORES] cabeçalhos:', header)

  // Índices fixos conforme estrutura confirmada pelo usuário
  const iDate     = 0  // Dia
  const iProd     = 3  // produto
  const iComissao = 5  // Valor comissão
  const iVal      = 6  // Valor Bruto Total

  // Mapa: nome_produto_normalizado → { offerId, isFront }
  const productMap = {}
  offers.forEach(offer => {
    const frontProducts = Array.isArray(offer.frontProduct)
      ? offer.frontProduct
      : (offer.frontProduct ? offer.frontProduct.split(',').map(s => s.trim()).filter(Boolean) : [])
    frontProducts.forEach(p => {
      if (p) productMap[p.trim().toLowerCase()] = { offerId: offer.id, isFront: true }
    })
    ;(offer.otherProducts || []).forEach(p => {
      if (p) productMap[p.trim().toLowerCase()] = { offerId: offer.id, isFront: false }
    })
  })
  console.log('[COMPRADORES] produtos mapeados:', Object.keys(productMap))

  const byOffer  = {}
  const rawRows  = {}   // { [offerId]: [{ date, product, comissao, faturamento, isFront }] }
  const notFound = new Set()

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    if (!row || !row[iDate]) continue

    const date = parseDate(row[iDate])
    if (!date || isNaN(date.getTime())) continue

    if (date < BUYERS_CUTOFF) continue

    const prodName = String(row[iProd] || '').trim()
    const match    = productMap[prodName.toLowerCase()]
    if (!match) { notFound.add(prodName); continue }

    const { offerId, isFront } = match
    const dateKey       = date.toISOString().split('T')[0]
    const valor         = parseNum(String(row[iVal]      || '0'))
    const comissaoValor = parseNum(String(row[iComissao] || '0'))

    // Agregação por data (existente)
    if (!byOffer[offerId]) byOffer[offerId] = {}
    if (!byOffer[offerId][dateKey]) {
      byOffer[offerId][dateKey] = { faturamento: 0, faturamento_front: 0, comissao: 0, comissao_front: 0, vendas: 0, vendas_front: 0 }
    }
    byOffer[offerId][dateKey].faturamento  += valor
    byOffer[offerId][dateKey].comissao     += comissaoValor
    byOffer[offerId][dateKey].vendas       += 1
    if (isFront) {
      byOffer[offerId][dateKey].vendas_front      += 1
      byOffer[offerId][dateKey].faturamento_front += valor
      byOffer[offerId][dateKey].comissao_front    += comissaoValor
    }

    // Linha bruta por produto (nova)
    if (!rawRows[offerId]) rawRows[offerId] = []
    rawRows[offerId].push({ date, product: prodName, comissao: comissaoValor, faturamento: valor, isFront })
  }

  if (notFound.size) console.warn('[COMPRADORES] ⚠️ Produtos sem vínculo:', [...notFound])
  console.log('[COMPRADORES] ✅ Ofertas com dados:', Object.keys(byOffer))
  return { byOffer, rawRows }
}

// ---------------------------------------------------------------------------
// MERGE final por dia para uma oferta
// ---------------------------------------------------------------------------
export function mergeOfferData(offerRows, metaRows, getRateForDate, buyersData, metaCurrency = 'USD') {
  const byDate = {}

  // 1. Seed: dados históricos da aba da oferta (gasto BRL + faturamento BRL como fallback)
  for (const row of offerRows) {
    const key = row.date.toISOString().split('T')[0]
    byDate[key] = {
      date:              row.date,
      gasto:             row.gasto_brl,  // BRL — será sobrescrito pelo Meta
      faturamento:       0,              // apenas buyers sheet (31/03+) preenche
      faturamento_front: 0,
      comissao:          0,
      comissao_front:    0,
      vendas:       row.vendas,
      vendas_front: row.vendas,
      cpc: null, cpc_ic: null, cpi: null, conv_checkout: null,
      clicks: 0, checkouts: 0, lp_views: 0,
    }
  }

  // 2. Faturamento, comissão e vendas dos compradores (fonte primária — BRL)
  if (buyersData) {
    for (const [dk, b] of Object.entries(buyersData)) {
      if (!byDate[dk]) byDate[dk] = { date: new Date(dk + 'T12:00:00Z'), gasto: 0, comissao: 0, cpc: null, cpc_ic: null, cpi: null, conv_checkout: null, clicks: 0, checkouts: 0, lp_views: 0 }
      byDate[dk].faturamento       = b.faturamento
      byDate[dk].faturamento_front = b.faturamento_front
      byDate[dk].comissao          = b.comissao
      byDate[dk].comissao_front    = b.comissao_front || 0
      byDate[dk].vendas            = b.vendas
      byDate[dk].vendas_front      = b.vendas_front
    }
  }

  // 3. Gasto e tráfego do Meta (fonte primária — USD → BRL)
  for (const meta of metaRows) {
    const key   = meta.date.toISOString().split('T')[0]
    // Converte USD → BRL usando a cotação do próprio dia (ou mais próxima anterior)
    const rate  = typeof getRateForDate === 'function' ? getRateForDate(key) : getRateForDate
    const gasto = metaCurrency === 'BRL' ? meta.spent_usd : meta.spent_usd * rate

    if (!byDate[key]) byDate[key] = { date: meta.date, faturamento: 0, faturamento_front: 0, comissao: 0, vendas: 0, vendas_front: 0, cpc: null, cpc_ic: null, cpi: null, conv_checkout: null }

    if (gasto > 0) byDate[key].gasto = gasto

    byDate[key].clicks    = meta.clicks
    byDate[key].checkouts = meta.checkouts
    byDate[key].lp_views  = meta.lp_views

    const g = byDate[key].gasto || gasto
    // CPC = gasto_BRL / clicks (calculado após conversão)
    if (meta.clicks > 0)    byDate[key].cpc    = g / meta.clicks
    // CPC→IC% = checkouts / clicks × 100
    if (meta.clicks > 0)    byDate[key].cpc_ic = (meta.checkouts / meta.clicks) * 100
    // CPI = gasto_BRL / checkouts (calculado após conversão)
    if (meta.checkouts > 0) byDate[key].cpi    = g / meta.checkouts
    // Conv% = vendas_front (compradores) / checkouts (Meta) × 100
    const vf = byDate[key].vendas_front || 0
    if (meta.checkouts > 0 && vf > 0) byDate[key].conv_checkout = (vf / meta.checkouts) * 100
  }

  return Object.values(byDate).sort((a, b) => a.date - b.date)
}

// ---------------------------------------------------------------------------
// FETCH de uma oferta
// ---------------------------------------------------------------------------
// Retorna { rows, failures } — failures lista as fontes que não carregaram (ex: ['Meta']),
// pra quem chama decidir manter o último dado bom em vez de mostrar gasto errado/zerado.
export async function fetchOfferData(offer, apiKey, getRateForDate, buyersDataByOffer = {}) {
  const failures = []
  const campaignFilter = offer.metaCampaignFilter
    ? offer.metaCampaignFilter.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
    : null

  const [offerRows, metaRows, oldMetaRows] = await Promise.all([
    fetchRange(offer.resultSheetId, `${offer.resultTab}!A:N`, apiKey)
      .then(parseOfferResultRows)
      .catch(e => { console.error(`[OFERTA] ${offer.name}:`, e.message); failures.push('aba da oferta'); return [] }),

    fetchRange(offer.metaSheetId, `${offer.metaTab}!A:Z`, apiKey)
      .then(rows => parseMetaRows(rows, campaignFilter))
      .catch(e => { console.error(`[META] ${offer.name}:`, e.message); failures.push('Meta'); return [] }),

    offer.oldMetaSheetId
      ? fetchRange(offer.oldMetaSheetId, `${offer.oldMetaTab || offer.metaTab}!A:Z`, apiKey)
          .then(rows => parseMetaRows(rows, campaignFilter))
          .catch(e => { console.warn(`[META-OLD] ${offer.name}:`, e.message); failures.push('Meta antiga'); return [] })
      : Promise.resolve([]),
  ])

  // Se há data de corte: old sheet apenas até essa data, new sheet a partir do dia seguinte
  let filteredOld = oldMetaRows
  let filteredNew = metaRows
  if (offer.oldMetaUntil) {
    const cutoff = new Date(offer.oldMetaUntil + 'T23:59:59')
    const from   = new Date(offer.oldMetaUntil + 'T00:00:00')
    from.setDate(from.getDate() + 1) // dia seguinte
    filteredOld = oldMetaRows.filter(r => r.date <= cutoff)
    filteredNew = metaRows.filter(r => r.date >= from)
  }
  const allMetaRows = [...filteredOld, ...filteredNew]

  const buyers = buyersDataByOffer[offer.id] || null
  const rows = mergeOfferData(offerRows, allMetaRows, getRateForDate, buyers, offer.metaCurrency || 'USD')
  return { rows, failures }
}

// ---------------------------------------------------------------------------
// FETCH de todas as ofertas
// ---------------------------------------------------------------------------
function offerRanges(offer) {
  const list = [
    [offer.resultSheetId, `${offer.resultTab}!A:N`],
    [offer.metaSheetId,   `${offer.metaTab}!A:Z`],
  ]
  if (offer.oldMetaSheetId) list.push([offer.oldMetaSheetId, `${offer.oldMetaTab || offer.metaTab}!A:Z`])
  return list.filter(([id]) => id)
}

export async function fetchAllOffersData(offers, apiKey, getRateForDate, buyersApiKey = '') {
  // Agrupa por planilha e busca em lote — as abas de resultado de todas as ofertas
  // ficam na mesma planilha: vira 1 leitura em vez de 1 por oferta.
  const bySheet = {}
  offers.forEach(o => offerRanges(o).forEach(([id, range]) => {
    (bySheet[id] ||= []).push(range)
  }))
  await Promise.all(Object.entries(bySheet).map(([id, ranges]) => prefetchBatch(id, ranges, apiKey)))

  let buyersDataByOffer = {}
  let productRows = {}
  let buyersFailed = false
  if (buyersApiKey) {
    try {
      const result = await fetchBuyersDataByOffer(buyersApiKey, offers)
      buyersDataByOffer = result.byOffer
      productRows       = result.rawRows
    } catch (e) {
      console.warn('[COMPRADORES] Erro:', e.message)
      buyersFailed = true
    }
  }

  const results = await Promise.allSettled(
    offers.map(o => fetchOfferData(o, apiKey, getRateForDate, buyersDataByOffer))
  )

  const data = {}
  const failures = {}  // { [offerId]: ['Meta', ...] }
  results.forEach((r, i) => {
    const id = offers[i].id
    if (r.status === 'fulfilled') {
      data[id] = r.value.rows
      if (r.value.failures.length) failures[id] = r.value.failures
    } else {
      data[id] = []
      failures[id] = ['erro inesperado']
      console.error(`[FETCH] ${offers[i].name}:`, r.reason)
    }
  })
  return { data, productRows, failures, buyersFailed }
}

// ---------------------------------------------------------------------------
// Detectar produtos em "todos os compradores" (diagnóstico)
// ---------------------------------------------------------------------------
export async function fetchAllBuyersProducts(buyersApiKey) {
  if (!buyersApiKey) return []
  try {
    const rows = await fetchRange(RESULTADO_GERAL_ID, "'todos compradores'!A:Z", buyersApiKey)
    if (!rows || rows.length < 2) return []
    const header = rows[0].map(h => String(h || '').trim())
    const iProd  = header.findIndex(h =>
      ['produto', 'product', 'nome do produto', 'oferta', 'item'].some(k => h.toLowerCase().includes(k))
    )
    if (iProd < 0) return []
    const products = new Set()
    for (let i = 1; i < rows.length; i++) {
      const p = String(rows[i]?.[iProd] || '').trim()
      if (p) products.add(p)
    }
    return Array.from(products)
  } catch (e) {
    console.warn('[fetchAllBuyersProducts]', e.message)
    return []
  }
}

// Diagnóstico: retorna primeiras 5 linhas de uma aba
export async function diagnosePlansSheet(sheetId, tabName, apiKey) {
  try {
    const rows = await fetchRange(sheetId, `${tabName}!A1:Z5`, apiKey)
    return { ok: true, rows, sheetId, tabName }
  } catch (e) {
    return { ok: false, error: e.message, sheetId, tabName }
  }
}
