import { useEffect, useMemo, useState } from 'react'
import { GitCommitVertical } from 'lucide-react'
import { useAppConfig } from '../hooks/useAppConfig'
import { useManualEntries } from '../hooks/useManualEntries'
import { parseMetaRows } from '../services/sheetsService'
import { TIPO_OPTIONS, RESULTADO_OPTIONS } from '../config/offerClassification'

// Ofertas que já rodavam quando o dash começou — data confirmada (1º gasto na planilha geral)
const CONFIRMED_START = {
  'correntes (las 7 llaves)': '2025-09-26',
  'código da reconquista':    '2025-10-31',
  'instinto mulher':          '2025-12-13',
  'secreto de ellas':         '2026-02-28',
  'libido oculta':            '2026-03-10',
}

const CACHE_KEY = 'dash_offer_first_spend'
const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

const norm = s => (s || '').trim().toLowerCase()
const ymd  = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const brDate = s => { const [y, m, d] = s.split('-'); return `${d}/${m}/${y}` }

function loadCache() {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY)) || {} } catch { return {} }
}
function saveCache(c) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(c)) } catch { /* sem storage: só não guarda */ }
}

// Identifica a configuração de planilha — se mudar, recalcula
const sheetSig = o => [o.metaSheetId, o.metaTab, o.oldMetaSheetId, o.oldMetaTab, o.metaCampaignFilter].join('|')

// Busca própria (não usa o cache/invalidação do sheetsService pra não interferir nas outras telas)
async function fetchMetaRows(sheetId, tab, apiKey, campaignFilter) {
  const range = `${tab}!A:Z`.replace(/ /g, '%20')
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}?key=${apiKey}`)
  if (!res.ok) throw new Error(`Sheets ${res.status}`)
  const json = await res.json()
  return parseMetaRows(json.values || [], campaignFilter)
}

// 1º dia com gasto na planilha da Meta (nova + antiga). null = sem gasto ainda
async function firstSpendDay(o, apiKey) {
  const filter = o.metaCampaignFilter
    ? o.metaCampaignFilter.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
    : null
  const sources = []
  if (o.metaSheetId && o.metaTab) sources.push([o.metaSheetId, o.metaTab])
  if (o.oldMetaSheetId) sources.push([o.oldMetaSheetId, o.oldMetaTab || o.metaTab])
  let first = null
  for (const [id, tab] of sources) {
    const rows = await fetchMetaRows(id, tab, apiKey, filter)
    const hit = rows.find(r => r.spent_usd > 0)
    if (hit && (!first || hit.date < first)) first = hit.date
  }
  return first ? ymd(first) : null
}

export default function OfferTimeline() {
  const { offers, apiKey } = useAppConfig()
  const { entries: manualEntries } = useManualEntries()
  const [firstSpend, setFirstSpend] = useState(loadCache)   // { [offerId]: { sig, date } }
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(0)

  // Busca o 1º gasto das ofertas que ainda não têm (4 por vez); datas achadas ficam guardadas
  useEffect(() => {
    if (!apiKey) return
    const cache = loadCache()
    const todo = offers.filter(o =>
      !CONFIRMED_START[norm(o.name)] &&
      (o.metaSheetId && o.metaTab) &&
      !(cache[o.id]?.date && cache[o.id].sig === sheetSig(o))
    )
    if (!todo.length) return
    let cancelled = false
    setLoading(true)
    ;(async () => {
      let next = 0, errors = 0
      const worker = async () => {
        while (next < todo.length) {
          const o = todo[next++]
          try {
            const date = await firstSpendDay(o, apiKey)
            if (date) cache[o.id] = { sig: sheetSig(o), date }
          } catch (e) {
            errors++
            console.warn('[TIMELINE]', o.name, e.message)
          }
        }
      }
      await Promise.all(Array.from({ length: Math.min(4, todo.length) }, worker))
      if (cancelled) return
      saveCache(cache)
      setFirstSpend({ ...cache })
      setFailed(errors)
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [offers, apiKey])

  // Data de início de cada oferta + de onde veio
  const items = useMemo(() => {
    const firstManual = {}
    manualEntries.forEach(e => {
      const k = norm(e.offerName)
      if (e.date && (!firstManual[k] || e.date < firstManual[k])) firstManual[k] = e.date
    })

    return offers.map(o => {
      const confirmed = CONFIRMED_START[norm(o.name)]
      if (confirmed) return { o, date: confirmed, source: 'confirmada', sure: true }

      const meta = firstSpend[o.id]
      if (meta?.date && meta.sig === sheetSig(o)) return { o, date: meta.date, source: '1º gasto na Meta', sure: true }

      if (firstManual[norm(o.name)]) return { o, date: firstManual[norm(o.name)], source: '1ª entrada manual', sure: true }

      if (o.startDate) return { o, date: o.startDate, source: 'data de início (sem gasto na Meta)', sure: true }
      if (o.createdAt) return { o, date: ymd(new Date(o.createdAt)), source: 'data de cadastro (sem gasto na Meta)', sure: true }
      return { o, date: null, source: 'sem data', sure: false }
    })
  }, [offers, firstSpend, manualEntries])

  // Agrupa mês a mês, da 1ª oferta até hoje (mais recente em cima); sem nenhuma data vai pro fim
  const { months, noDate } = useMemo(() => {
    const noDate = [], byMonth = {}
    items.forEach(it => {
      if (!it.date) return noDate.push(it)
      ;(byMonth[it.date.slice(0, 7)] ||= []).push(it)
    })
    Object.values(byMonth).forEach(arr =>
      arr.sort((a, b) => a.date.localeCompare(b.date) || a.o.name.localeCompare(b.o.name))
    )

    const keys = Object.keys(byMonth).sort()
    const months = []
    if (keys.length) {
      const [fy, fm] = keys[0].split('-').map(Number)
      const now = new Date()
      for (let d = new Date(fy, fm - 1, 1); d <= now; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
        const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        months.push({ key: k, label: `${MONTHS[d.getMonth()]} ${d.getFullYear()}`, items: byMonth[k] || [] })
      }
      months.reverse()
    }

    return { months, noDate }
  }, [items])

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-gray-100 flex-wrap">
        <div>
          <h2 className="font-semibold text-gray-800 flex items-center gap-2">
            <GitCommitVertical className="w-4 h-4 text-gray-500" />
            Timeline de ofertas
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Mês a mês, pelo 1º dia de gasto · mais recente em cima
            {loading && ' · buscando datas nas planilhas…'}
          </p>
        </div>
        {failed > 0 && (
          <p className="text-[11px] text-red-500 text-right">{failed} planilhas não carregaram</p>
        )}
      </div>

      {/* Legenda dos tipos */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 px-6 pt-4">
        {TIPO_OPTIONS.map(t => (
          <span key={t.value} className="inline-flex items-center gap-1.5 text-[11px] text-gray-500">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: t.color }} />
            {t.label}
          </span>
        ))}
      </div>

      <div className="px-6 py-4">
        <ol className="relative border-l-2 border-gray-100 ml-2 space-y-5">
          {months.map(m => <MonthBlock key={m.key} label={m.label} items={m.items} />)}
          {noDate.length > 0 && (
            <MonthBlock label="Sem data" sublabel="sem gasto na Meta e sem data de início" items={noDate} muted />
          )}
        </ol>
      </div>
    </div>
  )
}

function MonthBlock({ label, sublabel, items, showYear = false, muted = false }) {
  // Resumo por tipo no mês
  const counts = TIPO_OPTIONS
    .map(t => ({ ...t, n: items.filter(it => it.o.tipo === t.value).length }))
    .filter(t => t.n > 0)

  return (
    <li className="ml-5">
      <span className={`absolute -left-[7px] mt-1.5 w-3 h-3 rounded-full border-2 border-white ${items.length ? (muted ? 'bg-gray-400' : 'bg-blue-600') : 'bg-gray-200'}`} />
      <div className="flex items-baseline gap-2 flex-wrap">
        <p className={`text-sm font-semibold ${items.length ? 'text-gray-800' : 'text-gray-300'}`}>{label}</p>
        <p className="text-[11px] text-gray-400">
          {items.length} {items.length === 1 ? 'oferta' : 'ofertas'}
          {sublabel && ` · ${sublabel}`}
        </p>
        {counts.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {counts.map(t => (
              <span key={t.value} className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ color: t.color, backgroundColor: t.color + '1a' }}>
                {t.n} {t.label}
              </span>
            ))}
          </div>
        )}
      </div>

      {items.length > 0 && (
        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
          {items.map(it => <OfferChip key={it.o.id} it={it} showYear={showYear} />)}
        </div>
      )}
    </li>
  )
}

function OfferChip({ it, showYear }) {
  const { o, date, source, sure } = it
  const tipo = TIPO_OPTIONS.find(t => t.value === o.tipo)
  const res  = RESULTADO_OPTIONS.find(r => r.value === o.resultado)
  const dateLabel = date ? (showYear ? brDate(date) : brDate(date).slice(0, 5)) : '—'

  return (
    <div
      className="flex items-center gap-2 border border-gray-100 rounded-lg px-3 py-2 bg-white"
      style={{ borderLeft: `3px solid ${tipo?.color || '#e5e7eb'}` }}
      title={`Data: ${source}`}
    >
      <span className={`text-[11px] tabular-nums shrink-0 w-[70px] ${sure ? 'text-gray-500' : 'text-amber-600 font-semibold'}`}>
        {dateLabel}{!sure && ' ?'}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-gray-800 truncate">{o.name}</p>
        <p className="text-[10px] truncate" style={{ color: tipo?.color || '#9ca3af' }}>
          {tipo?.label || 'sem tipo'}
        </p>
      </div>
      {res && (
        <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-medium" style={{ color: res.color }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: res.color }} />
          {res.label}
        </span>
      )}
    </div>
  )
}
