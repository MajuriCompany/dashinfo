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

// Ofertas que não estão cadastradas no dash, mas entram na timeline (data = 1º gasto na planilha geral)
const EXTRA_OFFERS = [
  { id: 'extra_simpatia', name: 'Simpatia', date: '2025-12-04' },
]

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

    const registered = new Set(offers.map(o => norm(o.name)))
    const extras = EXTRA_OFFERS
      .filter(e => !registered.has(norm(e.name)))
      .map(e => ({ o: { id: e.id, name: e.name }, date: e.date, source: '1º gasto na planilha geral (não cadastrada no dash)', sure: true }))

    return [...extras, ...offers.map(o => {
      const confirmed = CONFIRMED_START[norm(o.name)]
      if (confirmed) return { o, date: confirmed, source: 'confirmada', sure: true }

      const meta = firstSpend[o.id]
      if (meta?.date && meta.sig === sheetSig(o)) return { o, date: meta.date, source: '1º gasto na Meta', sure: true }

      if (firstManual[norm(o.name)]) return { o, date: firstManual[norm(o.name)], source: '1ª entrada manual', sure: true }

      if (o.startDate) return { o, date: o.startDate, source: 'data de início (sem gasto na Meta)', sure: true }
      if (o.createdAt) return { o, date: ymd(new Date(o.createdAt)), source: 'data de cadastro (sem gasto na Meta)', sure: true }
      return { o, date: null, source: 'sem data', sure: false }
    })]
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
        months.push({ key: k, month: MONTHS[d.getMonth()], year: d.getFullYear(), items: byMonth[k] || [] })
      }
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
            Mês a mês, pelo 1º dia de gasto
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
            <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: t.color }} />
            {t.label}
          </span>
        ))}
      </div>

      {/* Calendário: um mês do lado do outro, ofertas empilhadas dentro do mês */}
      <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-3">
        {months.map(m => <MonthCard key={m.key} title={m.month} subtitle={m.year} items={m.items} />)}
        {noDate.length > 0 && <MonthCard title="Sem data" subtitle="sem gasto nem data de início" items={noDate} muted />}
      </div>
    </div>
  )
}

// Como cada tipo aparece no resumo do mês (singular / plural)
const TIPO_RESUMO = {
  modelado:       ['modelada', 'modeladas'],
  modelado_ruim:  ['modelada - oferta ruim', 'modeladas - oferta ruim'],
  outras_linguas: ['em outra língua', 'em outras línguas'],
  nao_valeu:      ['não valeu', 'não valeram'],
  escrito_100:    ['100% escrita', '100% escritas'],
  escrito_medio:  ['escrita mais ou menos', 'escritas mais ou menos'],
}
const RES_ORDEM = ['muito_bom', 'bom', 'medio', 'ruim']

// "3 modeladas (1 deu muito bom, 2 deu ruim)" — uma linha por tipo, na ordem de TIPO_OPTIONS
function monthSummary(items) {
  const tipos = [...TIPO_OPTIONS, { value: '', label: 'sem tipo', color: '#9ca3af' }]
  return tipos
    .map(t => {
      const its = items.filter(it => (it.o.tipo || '') === t.value)
      if (!its.length) return null
      const [sing, plur] = TIPO_RESUMO[t.value] || ['sem tipo', 'sem tipo']
      const res = RES_ORDEM
        .map(v => ({ r: RESULTADO_OPTIONS.find(x => x.value === v), n: its.filter(it => it.o.resultado === v).length }))
        .filter(x => x.n > 0)
      const semRes = its.filter(it => !RES_ORDEM.includes(it.o.resultado)).length
      return { t, n: its.length, label: its.length === 1 ? sing : plur, res, semRes }
    })
    .filter(Boolean)
}

function MonthCard({ title, subtitle, items, muted = false }) {
  const empty = items.length === 0
  const summary = monthSummary(items)

  return (
    <div className={`rounded-lg border flex flex-col ${empty ? 'border-dashed border-gray-200 bg-gray-50/50' : 'border-gray-200 bg-white'}`}>
      <div className={`px-3 py-2 border-b ${empty ? 'border-dashed border-gray-200' : 'border-gray-100 bg-gray-50'} rounded-t-lg`}>
        <div className="flex items-baseline justify-between gap-2">
          <p className={`text-sm font-semibold ${empty ? 'text-gray-300' : muted ? 'text-gray-500' : 'text-gray-800'}`}>
            {title} <span className="font-normal text-[11px] text-gray-400">{subtitle}</span>
          </p>
          <span className={`text-[11px] tabular-nums ${empty ? 'text-gray-300' : 'text-gray-500 font-semibold'}`}>
            {items.length}
          </span>
        </div>
        {/* Resumo: quantas de cada tipo e como foram */}
        {summary.length > 0 && (
          <ul className="mt-1.5 space-y-0.5">
            {summary.map(s => (
              <li key={s.t.value} className="text-xs leading-snug text-gray-600">
                <span className="font-semibold" style={{ color: s.t.color }}>{s.n} {s.label}</span>
                {(s.res.length > 0 || s.semRes > 0) && (
                  <span className="text-gray-400">
                    {' ('}
                    {s.res.map((x, i) => (
                      <span key={x.r.value}>
                        {i > 0 && ', '}
                        <span className="font-medium" style={{ color: x.r.color }}>{x.n} {x.r.label.toLowerCase()}</span>
                      </span>
                    ))}
                    {s.semRes > 0 && `${s.res.length ? ', ' : ''}${s.semRes} sem resultado`}
                    {')'}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {empty ? (
        <p className="px-3 py-3 text-[11px] text-gray-300 italic">nenhuma oferta</p>
      ) : (
        <ul className="p-2 space-y-1.5">
          {items.map(it => <OfferRow key={it.o.id} it={it} />)}
        </ul>
      )}
    </div>
  )
}

function OfferRow({ it }) {
  const { o, date, source } = it
  const tipo = TIPO_OPTIONS.find(t => t.value === o.tipo)
  const res  = RESULTADO_OPTIONS.find(r => r.value === o.resultado)

  return (
    <li
      className="rounded-md bg-white border border-gray-100 px-2.5 py-1.5"
      style={{ borderLeft: `3px solid ${tipo?.color || '#e5e7eb'}` }}
      title={`${o.name}
Tipo: ${tipo?.label || 'sem tipo'}${res ? `
Resultado: ${res.label}` : ''}
Data: ${source}`}
    >
      <div className="flex items-start gap-1.5">
        <span className="text-[10px] tabular-nums text-gray-400 shrink-0 mt-px">{date ? brDate(date).slice(0, 5) : '—'}</span>
        <span className="text-xs text-gray-800 leading-tight break-words flex-1 min-w-0">{o.name}</span>
        {res && <span className="w-2 h-2 rounded-full shrink-0 mt-1" style={{ backgroundColor: res.color }} />}
      </div>
      <p className="text-[10px] truncate mt-0.5" style={{ color: tipo?.color || '#9ca3af' }}>
        {tipo?.label || 'sem tipo'}
        {res && <span className="text-gray-400"> · {res.label}</span>}
      </p>
    </li>
  )
}
