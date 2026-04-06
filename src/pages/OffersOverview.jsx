import { useState, useContext, useMemo, useEffect, useRef } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { useAppConfig } from '../hooks/useAppConfig'
import { useSheetData } from '../hooks/useSheetData'
import { calcMetrics, signal } from '../utils/calculations'
import { fmt } from '../utils/formatters'
import { getPresetRange, inRange } from '../utils/dateUtils'
import { RefreshContext } from '../components/Layout'
import DateFilter from '../components/DateFilter'
import { Spinner, NoApiKey, ErrorState } from '../components/LoadingState'
import KPICard from '../components/KPICard'
import { TrendingUp, ShoppingCart, DollarSign, Percent, Plus, Trash2, Pencil, Check, X } from 'lucide-react'
import { useManualEntries } from '../hooks/useManualEntries'

// ── Helpers ───────────────────────────────────────────────────────────────────

const PIE_COLORS = [
  '#6366f1','#10b981','#f59e0b','#ef4444','#8b5cf6',
  '#06b6d4','#f97316','#84cc16','#ec4899','#14b8a6',
]

// Backward compat: old entries stored lucro + valorGasto; new entries store gasto + faturado
function getGasto(e)    { return e.gasto    ?? e.valorGasto ?? null }
function getLucro(e)    {
  if (e.faturado != null && getGasto(e) != null) return e.faturado - getGasto(e)
  return e.lucro ?? null
}
function convCC(e) {
  const cpc = e.custoClique, cpo = e.custoCheckout
  if (cpc && cpo && cpo > 0) return (cpc / cpo) * 100
  return null
}
function convCV(e) {
  const g = getGasto(e), cpo = e.custoCheckout
  if (e.vendas != null && cpo && g && g > 0) {
    const chk = g / cpo
    return chk > 0 ? (e.vendas / chk) * 100 : null
  }
  return null
}

function avg(arr) {
  const vals = arr.filter(v => v != null)
  return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null
}

// ── Pie ───────────────────────────────────────────────────────────────────────

function MiniPie({ data, title }) {
  if (!data || data.length === 0) return (
    <div className="flex flex-col items-center">
      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1">{title}</p>
      <p className="text-xs text-gray-300 mt-6">Sem dados</p>
    </div>
  )
  return (
    <div>
      <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2 text-center">{title}</p>
      <ResponsiveContainer width="100%" height={130}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" outerRadius={52} dataKey="value" label={false}>
            {data.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
          </Pie>
          <Tooltip formatter={(v, name) => [`${v.toFixed(1)}%`, name]} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
        </PieChart>
      </ResponsiveContainer>
      <div className="space-y-1 mt-1">
        {data.map((d, i) => (
          <div key={i} className="flex items-center gap-1.5 text-[11px] text-gray-600">
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
            <span className="truncate flex-1">{d.name}</span>
            <span className="font-semibold tabular-nums">{d.value.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── OfferCard (sheet data) ────────────────────────────────────────────────────

function OfferCard({ offer, rows, productRows, range, aliquota }) {
  const metrics = useMemo(() => calcMetrics(rows, aliquota), [rows, aliquota])

  const filteredProducts = useMemo(() => {
    return (productRows[offer.id] || []).filter(r => inRange(r.date, range.start, range.end))
  }, [productRows, offer.id, range])

  const byProduct = useMemo(() => {
    const agg = {}
    filteredProducts.forEach(r => {
      if (!agg[r.product]) agg[r.product] = { comissao: 0, faturamento: 0, vendas: 0 }
      agg[r.product].comissao    += r.comissao
      agg[r.product].faturamento += r.faturamento
      agg[r.product].vendas      += 1
    })
    return agg
  }, [filteredProducts])

  const totalVendas   = Object.values(byProduct).reduce((s, p) => s + p.vendas,   0)
  const totalComissao = Object.values(byProduct).reduce((s, p) => s + p.comissao, 0)

  const salesPie = Object.entries(byProduct)
    .filter(([, p]) => p.vendas > 0)
    .map(([name, p]) => ({ name, value: totalVendas > 0 ? (p.vendas / totalVendas) * 100 : 0 }))
    .sort((a, b) => b.value - a.value)

  const commPie = Object.entries(byProduct)
    .filter(([, p]) => p.comissao > 0)
    .map(([name, p]) => ({ name, value: totalComissao > 0 ? (p.comissao / totalComissao) * 100 : 0 }))
    .sort((a, b) => b.value - a.value)

  const mgLiqComissao = metrics.margem_liq_comissao

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
        <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: offer.color }} />
        <h3 className="text-sm font-bold text-gray-800 truncate">{offer.name}</h3>
      </div>
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-3 gap-2">
          <KPICard label="Comissão"   value={fmt.brl(metrics.comissao)}      icon={DollarSign} />
          <KPICard label="Gasto"      value={fmt.brl(metrics.gasto)}         icon={ShoppingCart} />
          <KPICard label="Lucro Líq." value={fmt.brl(metrics.lucro_liquido)} icon={TrendingUp} color={signal('lucro_liquido', metrics.lucro_liquido)} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <KPICard label="ROI"                value={fmt.roi(metrics.roi)} color={signal('roi', metrics.roi)} />
          <KPICard label="Mg Líq. (comissão)" value={fmt.pct((mgLiqComissao || 0) * 100)} icon={Percent} color={signal('margem_liq_comissao', mgLiqComissao)} />
        </div>
        {(salesPie.length > 0 || commPie.length > 0) ? (
          <div className="grid grid-cols-2 gap-4 pt-1 border-t border-gray-50">
            <MiniPie data={salesPie} title="% Vendas" />
            <MiniPie data={commPie}  title="% Comissão" />
          </div>
        ) : (
          <p className="text-xs text-gray-400 text-center pt-2 border-t border-gray-50">Sem dados de produtos no período</p>
        )}
      </div>
    </div>
  )
}

// ── Manual period presets ─────────────────────────────────────────────────────

const MANUAL_PRESETS = [
  { key: 'tudo',         label: 'Tudo' },
  { key: 'mes_atual',    label: 'Mês atual' },
  { key: 'mes_anterior', label: 'Mês anterior' },
  { key: 'last_30',      label: 'Últ. 30d' },
]

function getManualRange(key) {
  if (key === 'tudo') return null
  if (key === 'mes_anterior') {
    const today = new Date()
    let m = today.getMonth() - 1, y = today.getFullYear()
    if (m < 0) { m = 11; y-- }
    // mês comercial anterior: dia 3 até dia 2
    const s = new Date(y, m, 3)
    const e = new Date(y, m + 1, 2, 23, 59, 59)
    return { start: s, end: e }
  }
  return getPresetRange(key)
}

// ── Inline edit row ───────────────────────────────────────────────────────────

const EDIT_INPUT = 'border border-blue-300 rounded px-1.5 py-1 text-xs w-full focus:outline-none focus:border-blue-500'

function EditRow({ entry, onSave, onCancel }) {
  const [f, setF] = useState({
    date:          entry.date,
    offerName:     entry.offerName,
    custoClique:   entry.custoClique   ?? '',
    custoCheckout: entry.custoCheckout ?? '',
    vendas:        entry.vendas        ?? '',
    gasto:         getGasto(entry)     ?? '',
    faturado:      entry.faturado      ?? '',
  })

  const lucro = (f.faturado !== '' && f.gasto !== '')
    ? Number(f.faturado) - Number(f.gasto)
    : null

  return (
    <tr className="bg-blue-50/60">
      <td className="px-2 py-1.5"><input type="date" className={EDIT_INPUT} value={f.date} onChange={e => setF(p => ({ ...p, date: e.target.value }))} /></td>
      <td className="px-2 py-1.5"><input type="number" step="0.01" min="0" placeholder="Gasto" className={EDIT_INPUT} value={f.gasto} onChange={e => setF(p => ({ ...p, gasto: e.target.value }))} /></td>
      <td className="px-2 py-1.5"><input type="number" step="0.01" min="0" placeholder="Faturado" className={EDIT_INPUT} value={f.faturado} onChange={e => setF(p => ({ ...p, faturado: e.target.value }))} /></td>
      <td className="px-2 py-1.5 text-right text-xs font-semibold">
        {lucro != null
          ? <span className={lucro >= 0 ? 'text-emerald-600' : 'text-red-500'}>{lucro >= 0 ? '+' : ''}{fmt.brl(lucro)}</span>
          : <span className="text-gray-300">—</span>}
      </td>
      <td className="px-2 py-1.5"><input type="number" step="0.01" min="0" placeholder="CPC" className={EDIT_INPUT} value={f.custoClique} onChange={e => setF(p => ({ ...p, custoClique: e.target.value }))} /></td>
      <td className="px-2 py-1.5"><input type="number" step="0.01" min="0" placeholder="CPCo" className={EDIT_INPUT} value={f.custoCheckout} onChange={e => setF(p => ({ ...p, custoCheckout: e.target.value }))} /></td>
      <td className="px-2 py-1.5 text-right text-xs text-blue-500">
        {f.custoClique && f.custoCheckout && Number(f.custoCheckout) > 0
          ? `${((Number(f.custoClique) / Number(f.custoCheckout)) * 100).toFixed(1)}%`
          : <span className="text-gray-300">—</span>}
      </td>
      <td className="px-2 py-1.5 text-right text-xs text-purple-500">
        {f.vendas && f.gasto && f.custoCheckout && Number(f.gasto) > 0 && Number(f.custoCheckout) > 0
          ? `${((Number(f.vendas) / (Number(f.gasto) / Number(f.custoCheckout))) * 100).toFixed(1)}%`
          : <span className="text-gray-300">—</span>}
      </td>
      <td className="px-2 py-1.5"><input type="number" step="1" min="0" placeholder="Vendas" className={EDIT_INPUT} value={f.vendas} onChange={e => setF(p => ({ ...p, vendas: e.target.value }))} /></td>
      <td className="px-2 py-1.5 text-center">
        <div className="flex items-center gap-1 justify-center">
          <button onClick={() => onSave(f)} className="p-1 text-emerald-500 hover:text-emerald-700"><Check className="w-3.5 h-3.5" /></button>
          <button onClick={onCancel} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-3.5 h-3.5" /></button>
        </div>
      </td>
    </tr>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

const todayStr = () => new Date().toISOString().split('T')[0]

const EMPTY_FORM = { date: todayStr(), offerName: '', custoClique: '', custoCheckout: '', vendas: '', gasto: '', faturado: '' }

export default function OffersOverview() {
  const { settings, apiKey, buyersApiKey, activeOffers } = useAppConfig()
  const { data, productRows, loading, error, refresh }   = useSheetData(activeOffers, settings, apiKey, buyersApiKey)
  const { setRefreshFn }                                  = useContext(RefreshContext)
  const { entries, addEntry, updateEntry, removeEntry }  = useManualEntries()
  const [range, setRange]           = useState(getPresetRange('mes_atual'))
  const [manualPeriod, setManualPeriod] = useState('mes_atual')
  const [form, setForm]             = useState(EMPTY_FORM)
  const [editingId, setEditingId]   = useState(null)
  const gastoRef = useRef(null)

  useEffect(() => { setRefreshFn(() => refresh) }, [refresh, setRefreshFn])

  const filteredData = useMemo(() => {
    const result = {}
    activeOffers.forEach(o => {
      result[o.id] = (data[o.id] || []).filter(r => inRange(r.date, range.start, range.end))
    })
    return result
  }, [data, activeOffers, range])

  const manualRange = useMemo(() => getManualRange(manualPeriod), [manualPeriod])

  const visibleEntries = useMemo(() => {
    if (!manualRange) return [...entries].sort((a, b) => b.date.localeCompare(a.date))
    return entries
      .filter(e => {
        const d = new Date(e.date + 'T12:00:00')
        return inRange(d, manualRange.start, manualRange.end)
      })
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [entries, manualRange])

  const previewLucro = form.faturado !== '' && form.gasto !== ''
    ? Number(form.faturado) - Number(form.gasto)
    : null

  const previewCC = form.custoClique && form.custoCheckout && Number(form.custoCheckout) > 0
    ? (Number(form.custoClique) / Number(form.custoCheckout)) * 100
    : null

  const previewCV = form.vendas && form.gasto && form.custoCheckout && Number(form.gasto) > 0 && Number(form.custoCheckout) > 0
    ? (Number(form.vendas) / (Number(form.gasto) / Number(form.custoCheckout))) * 100
    : null

  function handleAdd(ev) {
    ev.preventDefault()
    if (!form.date || !form.offerName) return
    addEntry({ ...form, offerName: form.offerName.trim() })
    setForm({ ...EMPTY_FORM, date: form.date, offerName: form.offerName })
    gastoRef.current?.focus()
  }

  if (!apiKey)                              return <NoApiKey />
  if (loading && !Object.keys(data).length) return <Spinner />
  if (error)                                return <ErrorState message={error} />

  // Group visible entries by offer
  const byOffer = {}
  entries.forEach(e => {
    if (!byOffer[e.offerName]) byOffer[e.offerName] = []
    byOffer[e.offerName].push(e)
  })

  // Visible (period-filtered) by offer
  const visibleByOffer = {}
  visibleEntries.forEach(e => {
    if (!visibleByOffer[e.offerName]) visibleByOffer[e.offerName] = []
    visibleByOffer[e.offerName].push(e)
  })

  const offerNames = Object.keys(byOffer).sort()

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Todas as Ofertas</h2>
        <p className="text-xs text-gray-400 mt-0.5">Visão rápida de cada oferta · métricas + distribuição de produtos</p>
      </div>

      <DateFilter onChange={setRange} />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {activeOffers.map(offer => (
          <OfferCard
            key={offer.id}
            offer={offer}
            rows={filteredData[offer.id] || []}
            productRows={productRows}
            range={range}
            aliquota={settings.aliquota}
          />
        ))}
      </div>

      {/* ── Entradas Manuais ── */}
      <div className="space-y-3">

        {/* Formulário de adição */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-1">Entradas Manuais</h3>
          <p className="text-xs text-gray-400 mb-4">Ofertas em validação sem dashboard · registre dia a dia por oferta</p>

          <form onSubmit={handleAdd} className="space-y-3">
            {/* Linha 1: data + nome */}
            <div className="flex flex-wrap gap-2 items-end">
              <div>
                <label className="text-[11px] text-gray-400 block mb-1">Data</label>
                <input
                  type="date"
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                  value={form.date}
                  onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
                  required
                />
              </div>
              <div className="flex-1 min-w-48">
                <label className="text-[11px] text-gray-400 block mb-1">Nome da oferta</label>
                <input
                  type="text"
                  placeholder="ex: El Método del Vínculo"
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:border-blue-400"
                  value={form.offerName}
                  onChange={e => setForm(p => ({ ...p, offerName: e.target.value }))}
                  list="offer-names-list"
                  required
                />
                <datalist id="offer-names-list">
                  {[...new Set(entries.map(e => e.offerName))].map(n => (
                    <option key={n} value={n} />
                  ))}
                </datalist>
              </div>
            </div>

            {/* Linha 2: financeiro */}
            <div className="flex flex-wrap gap-2 items-end">
              <div>
                <label className="text-[11px] text-gray-400 block mb-1">Gasto (R$)</label>
                <input
                  ref={gastoRef}
                  type="number" step="0.01" min="0"
                  placeholder="ex: 300,00"
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-32 focus:outline-none focus:border-blue-400"
                  value={form.gasto}
                  onChange={e => setForm(p => ({ ...p, gasto: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-[11px] text-gray-400 block mb-1">Faturado (R$)</label>
                <input
                  type="number" step="0.01" min="0"
                  placeholder="ex: 650,00"
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-32 focus:outline-none focus:border-blue-400"
                  value={form.faturado}
                  onChange={e => setForm(p => ({ ...p, faturado: e.target.value }))}
                />
              </div>
              {previewLucro != null && (
                <div className="flex items-end pb-2">
                  <span className={`text-sm font-bold px-3 py-1.5 rounded-lg border ${previewLucro >= 0 ? 'text-emerald-600 bg-emerald-50 border-emerald-200' : 'text-red-500 bg-red-50 border-red-200'}`}>
                    Lucro: {previewLucro >= 0 ? '+' : ''}{fmt.brl(previewLucro)}
                  </span>
                </div>
              )}
            </div>

            {/* Linha 3: tráfego */}
            <div className="flex flex-wrap gap-2 items-end">
              <div>
                <label className="text-[11px] text-gray-400 block mb-1">CPC (R$)</label>
                <input
                  type="number" step="0.01" min="0"
                  placeholder="ex: 1,50"
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-28 focus:outline-none focus:border-blue-400"
                  value={form.custoClique}
                  onChange={e => setForm(p => ({ ...p, custoClique: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-[11px] text-gray-400 block mb-1">CPCo (R$)</label>
                <input
                  type="number" step="0.01" min="0"
                  placeholder="ex: 25,00"
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-28 focus:outline-none focus:border-blue-400"
                  value={form.custoCheckout}
                  onChange={e => setForm(p => ({ ...p, custoCheckout: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-[11px] text-gray-400 block mb-1">Vendas</label>
                <input
                  type="number" step="1" min="0"
                  placeholder="ex: 5"
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-24 focus:outline-none focus:border-blue-400"
                  value={form.vendas}
                  onChange={e => setForm(p => ({ ...p, vendas: e.target.value }))}
                />
              </div>
              {(previewCC != null || previewCV != null) && (
                <div className="flex items-end gap-3 pb-2 text-xs text-gray-500">
                  {previewCC != null && (
                    <span>Clique→Chk: <strong className="text-blue-600">{previewCC.toFixed(1)}%</strong></span>
                  )}
                  {previewCV != null && (
                    <span>Chk→Venda: <strong className="text-purple-600">{previewCV.toFixed(1)}%</strong></span>
                  )}
                </div>
              )}
              <button
                type="submit"
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 ml-auto"
              >
                <Plus className="w-4 h-4" /> Adicionar
              </button>
            </div>
          </form>
        </div>

        {/* Filtro de período + cards por oferta */}
        {offerNames.length > 0 && (
          <>
            {/* Seletor de período compacto */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 shrink-0">Período:</span>
              {MANUAL_PRESETS.map(p => (
                <button
                  key={p.key}
                  onClick={() => setManualPeriod(p.key)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    manualPeriod === p.key
                      ? 'bg-blue-600 text-white'
                      : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {offerNames.map(name => {
                const allForOffer     = byOffer[name].sort((a, b) => b.date.localeCompare(a.date))
                const periodForOffer  = visibleByOffer[name] || []

                const totalGasto    = periodForOffer.reduce((s, e) => s + (getGasto(e) ?? 0), 0)
                const totalFaturado = periodForOffer.reduce((s, e) => s + (e.faturado ?? 0), 0)
                const totalLucro    = periodForOffer.reduce((s, e) => s + (getLucro(e) ?? 0), 0)
                const totalVendas   = periodForOffer.reduce((s, e) => s + (e.vendas ?? 0), 0)

                const avgCPC  = avg(periodForOffer.map(e => e.custoClique))
                const avgCPCo = avg(periodForOffer.map(e => e.custoCheckout))
                const avgCC   = avg(periodForOffer.map(e => convCC(e)))
                const avgCV   = avg(periodForOffer.map(e => convCV(e)))

                return (
                  <div key={name} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                    {/* Header */}
                    <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-2">
                      <h4 className="text-sm font-semibold text-gray-800">{name}</h4>
                      <div className="flex items-center gap-2 shrink-0">
                        {periodForOffer.length > 0 && (
                          <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${totalLucro >= 0 ? 'text-emerald-600 bg-emerald-50 border-emerald-200' : 'text-red-500 bg-red-50 border-red-200'}`}>
                            {totalLucro >= 0 ? '+' : ''}{fmt.brl(totalLucro)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Resumo do período */}
                    {periodForOffer.length > 0 && (
                      <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 grid grid-cols-4 gap-2 text-center">
                        <div>
                          <p className="text-[10px] text-gray-400 uppercase tracking-wide">Gasto</p>
                          <p className="text-xs font-semibold text-gray-700">{fmt.brl(totalGasto)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-gray-400 uppercase tracking-wide">Faturado</p>
                          <p className="text-xs font-semibold text-gray-700">{fmt.brl(totalFaturado)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-gray-400 uppercase tracking-wide">Vendas</p>
                          <p className="text-xs font-semibold text-gray-700">{totalVendas > 0 ? totalVendas : '—'}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-gray-400 uppercase tracking-wide">Dias</p>
                          <p className="text-xs font-semibold text-gray-700">{periodForOffer.length}</p>
                        </div>
                      </div>
                    )}

                    {/* Médias de tráfego */}
                    {(avgCPC != null || avgCPCo != null || avgCC != null || avgCV != null) && (
                      <div className="px-4 py-2 border-b border-gray-100 flex flex-wrap gap-x-4 gap-y-1">
                        {avgCPC  != null && <span className="text-[11px] text-gray-500">Média CPC: <strong className="text-gray-700">{fmt.brl(avgCPC)}</strong></span>}
                        {avgCPCo != null && <span className="text-[11px] text-gray-500">Média CPCo: <strong className="text-gray-700">{fmt.brl(avgCPCo)}</strong></span>}
                        {avgCC   != null && <span className="text-[11px] text-gray-500">Clique→Chk: <strong className="text-blue-600">{avgCC.toFixed(1)}%</strong></span>}
                        {avgCV   != null && <span className="text-[11px] text-gray-500">Chk→Venda: <strong className="text-purple-600">{avgCV.toFixed(1)}%</strong></span>}
                      </div>
                    )}

                    {/* Tabela de dias */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50 border-b border-gray-100">
                          <tr>
                            <th className="text-left px-3 py-2 text-gray-400 font-medium whitespace-nowrap">Data</th>
                            <th className="text-right px-3 py-2 text-gray-400 font-medium whitespace-nowrap">Gasto</th>
                            <th className="text-right px-3 py-2 text-gray-400 font-medium whitespace-nowrap">Faturado</th>
                            <th className="text-right px-3 py-2 text-gray-400 font-medium whitespace-nowrap">Lucro</th>
                            <th className="text-right px-3 py-2 text-gray-400 font-medium whitespace-nowrap">CPC</th>
                            <th className="text-right px-3 py-2 text-gray-400 font-medium whitespace-nowrap">CPCo</th>
                            <th className="text-right px-3 py-2 text-gray-400 font-medium whitespace-nowrap">Clique→Chk</th>
                            <th className="text-right px-3 py-2 text-gray-400 font-medium whitespace-nowrap">Chk→Venda</th>
                            <th className="text-right px-3 py-2 text-gray-400 font-medium whitespace-nowrap">Vendas</th>
                            <th className="w-14" />
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {allForOffer.map(e => {
                            const lucro = getLucro(e)
                            const cc = convCC(e)
                            const cv = convCV(e)
                            const g  = getGasto(e)

                            if (editingId === e.id) {
                              return (
                                <EditRow
                                  key={e.id}
                                  entry={e}
                                  onSave={fields => { updateEntry(e.id, fields); setEditingId(null) }}
                                  onCancel={() => setEditingId(null)}
                                />
                              )
                            }

                            return (
                              <tr key={e.id} className="hover:bg-gray-50/80">
                                <td className="px-3 py-2.5 text-gray-600 font-medium whitespace-nowrap">{e.date}</td>
                                <td className="px-3 py-2.5 text-right text-gray-600">{g != null ? fmt.brl(g) : <span className="text-gray-300">—</span>}</td>
                                <td className="px-3 py-2.5 text-right text-gray-600">{e.faturado != null ? fmt.brl(e.faturado) : <span className="text-gray-300">—</span>}</td>
                                <td className="px-3 py-2.5 text-right">
                                  {lucro != null
                                    ? <span className={`px-1.5 py-0.5 rounded font-semibold ${lucro >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{lucro >= 0 ? '+' : ''}{fmt.brl(lucro)}</span>
                                    : <span className="text-gray-300">—</span>}
                                </td>
                                <td className="px-3 py-2.5 text-right text-gray-600">{e.custoClique != null ? fmt.brl(e.custoClique) : <span className="text-gray-300">—</span>}</td>
                                <td className="px-3 py-2.5 text-right text-gray-600">{e.custoCheckout != null ? fmt.brl(e.custoCheckout) : <span className="text-gray-300">—</span>}</td>
                                <td className="px-3 py-2.5 text-right">{cc != null ? <span className="text-blue-600 font-medium">{cc.toFixed(1)}%</span> : <span className="text-gray-300">—</span>}</td>
                                <td className="px-3 py-2.5 text-right">{cv != null ? <span className="text-purple-600 font-medium">{cv.toFixed(1)}%</span> : <span className="text-gray-300">—</span>}</td>
                                <td className="px-3 py-2.5 text-right text-gray-600">{e.vendas != null ? e.vendas : <span className="text-gray-300">—</span>}</td>
                                <td className="px-2 py-2.5 text-center">
                                  <div className="flex items-center gap-0.5 justify-center">
                                    <button onClick={() => setEditingId(e.id)} className="p-1 text-gray-300 hover:text-blue-400">
                                      <Pencil className="w-3 h-3" />
                                    </button>
                                    <button onClick={() => removeEntry(e.id)} className="p-1 text-gray-300 hover:text-red-400">
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}

        {offerNames.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-2">Nenhuma entrada ainda.</p>
        )}
      </div>
    </div>
  )
}
