import { useState, useContext, useMemo } from 'react'
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
import { TrendingUp, ShoppingCart, DollarSign, Percent, Plus, Trash2 } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useManualEntries } from '../hooks/useManualEntries'

// ── Pie helpers ──────────────────────────────────────────────────────────────

const PIE_COLORS = [
  '#6366f1','#10b981','#f59e0b','#ef4444','#8b5cf6',
  '#06b6d4','#f97316','#84cc16','#ec4899','#14b8a6',
]

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
          <Tooltip
            formatter={(v, name) => [`${v.toFixed(1)}%`, name]}
            contentStyle={{ fontSize: 11, borderRadius: 8 }}
          />
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

// ── Per-offer card ────────────────────────────────────────────────────────────

function OfferCard({ offer, rows, productRows, range, aliquota }) {
  const metrics = useMemo(() => calcMetrics(rows, aliquota), [rows, aliquota])

  // Filter product rows by date range
  const filteredProducts = useMemo(() => {
    const offerPRows = productRows[offer.id] || []
    return offerPRows.filter(r => inRange(r.date, range.start, range.end))
  }, [productRows, offer.id, range])

  // Aggregate by product
  const byProduct = useMemo(() => {
    const agg = {}
    filteredProducts.forEach(r => {
      if (!agg[r.product]) agg[r.product] = { comissao: 0, faturamento: 0, vendas: 0 }
      agg[r.product].comissao   += r.comissao
      agg[r.product].faturamento += r.faturamento
      agg[r.product].vendas     += 1
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
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
        <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: offer.color }} />
        <h3 className="text-sm font-bold text-gray-800 truncate">{offer.name}</h3>
      </div>

      <div className="p-4 space-y-4">
        {/* KPIs: 3 principais */}
        <div className="grid grid-cols-3 gap-2">
          <KPICard label="Comissão"    value={fmt.brl(metrics.comissao)}       icon={DollarSign}  />
          <KPICard label="Gasto"       value={fmt.brl(metrics.gasto)}          icon={ShoppingCart} />
          <KPICard label="Lucro Líq."  value={fmt.brl(metrics.lucro_liquido)}  icon={TrendingUp}  color={signal('lucro_liquido', metrics.lucro_liquido)} />
        </div>

        {/* KPIs: ROI + Mg */}
        <div className="grid grid-cols-2 gap-2">
          <KPICard label="ROI"         value={fmt.roi(metrics.roi)}  color={signal('roi', metrics.roi)} />
          <KPICard label="Mg Líq. (comissão)" value={fmt.pct((mgLiqComissao || 0) * 100)} icon={Percent} color={signal('margem_liq_comissao', mgLiqComissao)} />
        </div>

        {/* Pie charts */}
        {(salesPie.length > 0 || commPie.length > 0) ? (
          <div className="grid grid-cols-2 gap-4 pt-1 border-t border-gray-50">
            <MiniPie data={salesPie} title="% Vendas" />
            <MiniPie data={commPie}  title="% Comissão" />
          </div>
        ) : (
          <p className="text-xs text-gray-400 text-center pt-2 border-t border-gray-50">
            Sem dados de produtos no período
          </p>
        )}
      </div>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

const todayStr = () => new Date().toISOString().split('T')[0]

export default function OffersOverview() {
  const { settings, apiKey, buyersApiKey, activeOffers } = useAppConfig()
  const { data, productRows, loading, error, refresh }   = useSheetData(activeOffers, settings, apiKey, buyersApiKey)
  const { setRefreshFn }                                  = useContext(RefreshContext)
  const { entries, addEntry, removeEntry }               = useManualEntries()
  const [range, setRange] = useState(getPresetRange('mes_atual'))

  // Form state
  const [form, setForm] = useState({ date: todayStr(), offerName: '', lucro: '' })
  const lucroRef = useRef(null)

  useEffect(() => { setRefreshFn(() => refresh) }, [refresh, setRefreshFn])

  const filteredData = useMemo(() => {
    const result = {}
    activeOffers.forEach(offer => {
      result[offer.id] = (data[offer.id] || []).filter(r => inRange(r.date, range.start, range.end))
    })
    return result
  }, [data, activeOffers, range])

  // Manual entries filtered by date range
  const filteredEntries = useMemo(() =>
    entries.filter(e => {
      const d = new Date(e.date + 'T12:00:00')
      return inRange(d, range.start, range.end)
    }).sort((a, b) => b.date.localeCompare(a.date))
  , [entries, range])

  const manualTotal = filteredEntries.reduce((s, e) => s + e.lucro, 0)

  function handleAdd(ev) {
    ev.preventDefault()
    if (!form.date || !form.offerName || form.lucro === '') return
    addEntry(form.date, form.offerName.trim(), form.lucro)
    setForm({ date: todayStr(), offerName: '', lucro: '' })
    lucroRef.current?.focus()
  }

  if (!apiKey)                              return <NoApiKey />
  if (loading && !Object.keys(data).length) return <Spinner />
  if (error)                                return <ErrorState message={error} />

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
        {/* Header + form */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-800">Entradas Manuais</h3>
              <p className="text-xs text-gray-400 mt-0.5">Ofertas em validação sem dashboard · registre dia a dia por oferta</p>
            </div>
            {filteredEntries.length > 0 && (
              <div className={`text-sm font-bold px-3 py-1.5 rounded-lg border ${manualTotal >= 0 ? 'text-emerald-600 bg-emerald-50 border-emerald-200' : 'text-red-500 bg-red-50 border-red-200'}`}>
                Total no período: {manualTotal >= 0 ? '+' : ''}{fmt.brl(manualTotal)}
              </div>
            )}
          </div>
          <form onSubmit={handleAdd} className="flex flex-wrap gap-2 items-end">
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
              {/* Sugere nomes já usados */}
              <datalist id="offer-names-list">
                {[...new Set(entries.map(e => e.offerName))].map(n => (
                  <option key={n} value={n} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="text-[11px] text-gray-400 block mb-1">Lucro / Prejuízo (R$)</label>
              <input
                ref={lucroRef}
                type="number"
                step="0.01"
                placeholder="ex: 350 ou -120"
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-36 focus:outline-none focus:border-blue-400"
                value={form.lucro}
                onChange={e => setForm(p => ({ ...p, lucro: e.target.value }))}
                required
              />
            </div>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" /> Adicionar
            </button>
          </form>
        </div>

        {/* One card per offer — full history (no date filter) */}
        {(() => {
          const byOffer = {}
          entries.forEach(e => {
            if (!byOffer[e.offerName]) byOffer[e.offerName] = []
            byOffer[e.offerName].push(e)
          })
          const offerNames = Object.keys(byOffer).sort()
          if (offerNames.length === 0) return (
            <p className="text-xs text-gray-400 text-center py-2">Nenhuma entrada ainda.</p>
          )
          return (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {offerNames.map(name => {
                const offerEntries = byOffer[name].sort((a, b) => b.date.localeCompare(a.date))
                const total = offerEntries.reduce((s, e) => s + e.lucro, 0)
                return (
                  <div key={name} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-gray-800">{name}</h4>
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${total >= 0 ? 'text-emerald-600 bg-emerald-50 border-emerald-200' : 'text-red-500 bg-red-50 border-red-200'}`}>
                        Total: {total >= 0 ? '+' : ''}{fmt.brl(total)}
                      </span>
                    </div>
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 border-b border-gray-100">
                        <tr>
                          <th className="text-left px-4 py-2 text-gray-400 font-medium">Data</th>
                          <th className="text-right px-4 py-2 text-gray-400 font-medium">Lucro / Prejuízo</th>
                          <th className="w-8" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {offerEntries.map(e => (
                          <tr key={e.id} className="hover:bg-gray-50/80">
                            <td className="px-4 py-2.5 text-gray-600 font-medium">{e.date}</td>
                            <td className="px-4 py-2.5 text-right">
                              <span className={`px-2 py-0.5 rounded-md font-semibold border ${e.lucro >= 0 ? 'text-emerald-600 bg-emerald-50 border-emerald-200' : 'text-red-500 bg-red-50 border-red-200'}`}>
                                {e.lucro >= 0 ? '+' : ''}{fmt.brl(e.lucro)}
                              </span>
                            </td>
                            <td className="px-2 py-2.5 text-center">
                              <button onClick={() => removeEntry(e.id)} className="p-1 text-gray-300 hover:text-red-400">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              })}
            </div>
          )
        })()}
      </div>
    </div>
  )
}
