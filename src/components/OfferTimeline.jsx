import { useEffect, useMemo, useState } from 'react'
import { GitCommitVertical } from 'lucide-react'
import { useAppConfig } from '../hooks/useAppConfig'
import { useManualEntries } from '../hooks/useManualEntries'
import { parseMetaRows } from '../services/sheetsService'
import { TIPO_OPTIONS } from '../config/offerClassification'

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

      {/* Resumo do período: quantas de cada tipo e como foram */}
      <PeriodSummary items={items} />

      {/* Calendário: um mês do lado do outro, ofertas empilhadas dentro do mês */}
      <div className="p-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
        {months.map(m => <MonthCard key={m.key} title={m.month} subtitle={m.year} items={m.items} />)}
        {noDate.length > 0 && <MonthCard title="Sem data" subtitle="sem gasto nem data de início" items={noDate} />}
      </div>
    </div>
  )
}

// ── Resultado: só 3 cores (vermelho ruim, laranja médio, verde bom) ──────────

const RES_ORDEM = ['muito_bom', 'bom', 'medio', 'ruim']
const RES_INFO = {
  muito_bom: { label: 'Deu muito bom', short: 'muito bom', color: '#16a34a' },
  bom:       { label: 'Deu bom',       short: 'bom',       color: '#16a34a' },
  medio:     { label: 'Deu médio',     short: 'médio',     color: '#ea580c' },
  ruim:      { label: 'Deu ruim',      short: 'ruim',      color: '#dc2626' },
}

// Como cada tipo aparece nos resumos (singular / plural)
const TIPO_RESUMO = {
  modelado:       ['modelada', 'modeladas'],
  modelado_ruim:  ['modelada - oferta ruim', 'modeladas - oferta ruim'],
  outras_linguas: ['em outra língua', 'em outras línguas'],
  nao_valeu:      ['não valeu', 'não valeram'],
  escrito_100:    ['100% escrita', '100% escritas'],
  escrito_medio:  ['escrita mais ou menos', 'escritas mais ou menos'],
  '':             ['sem tipo', 'sem tipo'],
}
const TIPOS_COM_VAZIO = [...TIPO_OPTIONS, { value: '', label: 'Sem tipo' }]

// Conta por tipo e, dentro de cada tipo, por resultado
function byTipo(items) {
  return TIPOS_COM_VAZIO
    .map(t => {
      const its = items.filter(it => (it.o.tipo || '') === t.value)
      if (!its.length) return null
      const [sing, plur] = TIPO_RESUMO[t.value]
      const res = {}
      RES_ORDEM.forEach(v => { res[v] = its.filter(it => it.o.resultado === v).length })
      const semRes = its.filter(it => !RES_ORDEM.includes(it.o.resultado)).length
      return { t, n: its.length, label: its.length === 1 ? sing : plur, res, semRes }
    })
    .filter(Boolean)
}

// "2 modeladas (2 ruim)" — preto no tipo, cor só no resultado
function ResumoLinha({ s }) {
  const parts = RES_ORDEM
    .filter(v => s.res[v] > 0)
    .map(v => <span key={v} className="font-medium" style={{ color: RES_INFO[v].color }}>{s.res[v]} {RES_INFO[v].short}</span>)
  if (s.semRes > 0) parts.push(<span key="sem" className="text-gray-400">{s.semRes} sem resultado</span>)
  return (
    <li className="text-xs leading-snug text-gray-800">
      <span className="font-semibold">{s.n} {s.label}</span>
      {parts.length > 0 && (
        <span className="text-gray-400">
          {' ('}
          {parts.map((p, i) => <span key={i}>{i > 0 && ', '}{p}</span>)}
          {')'}
        </span>
      )}
    </li>
  )
}

// ── Resumo por período (1m … 6m) ─────────────────────────────────────────────

const PERIODOS = [
  { key: 1, label: '1m' },
  { key: 2, label: '2m' },
  { key: 3, label: '3m' },
  { key: 4, label: '4m' },
  { key: 6, label: '6m' },
  { key: 0, label: 'Tudo' },
]

function PeriodSummary({ items }) {
  const [meses, setMeses] = useState(3)

  const doPeriodo = useMemo(() => {
    if (!meses) return items.filter(it => it.date)
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    d.setMonth(d.getMonth() - meses)
    const corte = ymd(d)
    return items.filter(it => it.date && it.date >= corte)
  }, [items, meses])

  const linhas = byTipo(doPeriodo)
  const comRes = doPeriodo.filter(it => RES_ORDEM.includes(it.o.resultado))
  const geral = RES_ORDEM.map(v => {
    const n = comRes.filter(it => it.o.resultado === v).length
    return { v, n, pct: comRes.length ? (n / comRes.length) * 100 : 0 }
  })

  return (
    <div className="px-6 pt-4">
      <div className="rounded-lg border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between gap-3 flex-wrap px-4 py-3 bg-gray-50 border-b border-gray-100">
          <p className="text-sm font-semibold text-gray-800">
            Resumo · {doPeriodo.length} {doPeriodo.length === 1 ? 'oferta' : 'ofertas'}
            <span className="font-normal text-xs text-gray-400">
              {meses === 1 ? ' começaram no último mês' : meses ? ` começaram nos últimos ${meses} meses` : ' no total'}
            </span>
          </p>
          <div className="flex gap-1">
            {PERIODOS.map(p => (
              <button
                key={p.key}
                onClick={() => setMeses(p.key)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  meses === p.key ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-100'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {doPeriodo.length === 0 ? (
          <p className="px-4 py-6 text-xs text-gray-400 italic">Nenhuma oferta começou nesse período.</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-6 p-4">
            {/* Por tipo */}
            <div className="overflow-x-auto">
              <table className="w-full max-w-2xl text-xs">
                <thead>
                  <tr className="text-gray-400">
                    <th className="text-left font-semibold pb-2">Tipo</th>
                    <th className="text-right font-semibold pb-2 px-2">Ofertas</th>
                    {RES_ORDEM.map(v => (
                      <th key={v} className="text-right font-semibold pb-2 px-2 whitespace-nowrap" style={{ color: RES_INFO[v].color }}>{RES_INFO[v].short}</th>
                    ))}
                    <th className="text-right font-semibold pb-2 pl-2 whitespace-nowrap">sem resultado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {linhas.map(s => (
                    <tr key={s.t.value}>
                      <td className="py-1.5 text-gray-800 font-medium">{s.t.label}</td>
                      <td className="py-1.5 px-2 text-right tabular-nums font-semibold text-gray-800">{s.n}</td>
                      {RES_ORDEM.map(v => (
                        <td key={v} className="py-1.5 px-2 text-right tabular-nums" style={{ color: s.res[v] ? RES_INFO[v].color : '#d1d5db' }}>
                          {s.res[v] || '–'}
                        </td>
                      ))}
                      <td className="py-1.5 pl-2 text-right tabular-nums text-gray-400">{s.semRes || '–'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Geral em % */}
            <div className="lg:border-l lg:border-gray-100 lg:pl-6 min-w-[220px]">
              <p className="text-xs font-semibold text-gray-500 mb-2">
                Geral <span className="font-normal text-gray-400">· {comRes.length} com resultado</span>
              </p>
              <ul className="space-y-1.5">
                {geral.map(g => (
                  <li key={g.v} className="text-xs">
                    <div className="flex justify-between gap-3">
                      <span style={{ color: RES_INFO[g.v].color }} className="font-medium">{RES_INFO[g.v].label}</span>
                      <span className="tabular-nums text-gray-800 font-semibold">
                        {g.pct.toFixed(0)}% <span className="font-normal text-gray-400">({g.n})</span>
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-gray-100 mt-1 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${g.pct}%`, backgroundColor: RES_INFO[g.v].color }} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Quais são as ofertas do período, agrupadas por tipo */}
        {doPeriodo.length > 0 && (
          <div className="border-t border-gray-100 p-4">
            <p className="text-xs font-semibold text-gray-500 mb-2">Ofertas do período</p>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-6 gap-y-3">
              {linhas.map(s => (
                <div key={s.t.value}>
                  <p className="text-xs font-semibold text-gray-800 mb-0.5">{s.t.label} <span className="font-normal text-gray-400">({s.n})</span></p>
                  <ul>
                    {doPeriodo
                      .filter(it => (it.o.tipo || '') === s.t.value)
                      .sort((a, b) => RES_RANK(a) - RES_RANK(b) || a.o.name.localeCompare(b.o.name))
                      .map(it => {
                        const res = RES_INFO[it.o.resultado]
                        return (
                          <li key={it.o.id} className="text-xs leading-snug py-0.5" title={`Começou em ${brDate(it.date)}`}>
                            <span className="text-gray-900">{it.o.name}</span>
                            <span className="text-gray-300"> - </span>
                            {res
                              ? <span className="font-medium" style={{ color: res.color }}>{res.label}</span>
                              : <span className="text-gray-400">sem resultado</span>}
                          </li>
                        )
                      })}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Ordem na lista: muito bom → bom → médio → ruim → sem resultado
const RES_RANK = it => { const i = RES_ORDEM.indexOf(it.o.resultado); return i < 0 ? 99 : i }

// ── Mês do calendário ────────────────────────────────────────────────────────

function MonthCard({ title, subtitle, items }) {
  const empty = items.length === 0
  const resumo = byTipo(items)

  return (
    <div className={`rounded-lg border flex flex-col ${empty ? 'border-dashed border-gray-200 bg-gray-50/50' : 'border-gray-200 bg-white'}`}>
      <div className={`px-4 py-3 border-b ${empty ? 'border-dashed border-gray-200' : 'border-gray-100 bg-gray-50'} rounded-t-lg`}>
        <div className="flex items-baseline justify-between gap-2">
          <p className={`text-sm font-semibold ${empty ? 'text-gray-300' : 'text-gray-800'}`}>
            {title} <span className="font-normal text-[11px] text-gray-400">{subtitle}</span>
          </p>
          <span className={`text-xs tabular-nums ${empty ? 'text-gray-300' : 'text-gray-500 font-semibold'}`}>
            {items.length}
          </span>
        </div>
        {resumo.length > 0 && (
          <ul className="mt-1.5 space-y-0.5">
            {resumo.map(s => <ResumoLinha key={s.t.value} s={s} />)}
          </ul>
        )}
      </div>

      {empty ? (
        <p className="px-4 py-3 text-[11px] text-gray-300 italic">nenhuma oferta</p>
      ) : (
        <ul className="p-2 space-y-0.5">
          {items.map(it => <OfferRow key={it.o.id} it={it} />)}
        </ul>
      )}
    </div>
  )
}

// "100% escrito - Libido Oculta 1.0 - Deu médio"
function OfferRow({ it }) {
  const { o, date, source } = it
  const tipo = TIPO_OPTIONS.find(t => t.value === o.tipo)
  const res  = RES_INFO[o.resultado]

  return (
    <li
      className="rounded-md px-2.5 py-1.5 text-xs leading-snug hover:bg-gray-50"
      title={`Começou em ${date ? brDate(date) : '—'} · data: ${source}`}
    >
      <span className="text-gray-500">{tipo?.label || 'Sem tipo'}</span>
      <span className="text-gray-300"> - </span>
      <span className="text-gray-900 font-medium">{o.name}</span>
      <span className="text-gray-300"> - </span>
      {res
        ? <span className="font-medium" style={{ color: res.color }}>{res.label}</span>
        : <span className="text-gray-400">sem resultado</span>}
    </li>
  )
}
