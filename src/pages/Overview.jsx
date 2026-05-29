import { useState, useEffect, useContext, useMemo, useRef } from 'react'
import { DollarSign, TrendingUp, ShoppingCart, Percent, ChevronDown, Check } from 'lucide-react'
import { useAppConfig } from '../hooks/useAppConfig'
import { useSheetData } from '../hooks/useSheetData'
import { calcMetrics, signal } from '../utils/calculations'
import { fmt } from '../utils/formatters'
import { getPresetRange, getMesAtualKey, inRange } from '../utils/dateUtils'
import { fetchAndCacheRates, makeGetRate } from '../services/exchangeRateService'
import { useMonthlyGoals } from '../hooks/useMonthlyGoals'
import { useManualEntries } from '../hooks/useManualEntries'
import { RefreshContext } from '../components/Layout'
import KPICard from '../components/KPICard'
import DateFilter from '../components/DateFilter'
import GoalProgressBar from '../components/ProgressBar'
import ProfitLineChart from '../components/charts/ProfitLineChart'
import OfferBarChart from '../components/charts/OfferBarChart'
import OfferPieChart from '../components/charts/OfferPieChart'
import { Spinner, NoApiKey, ErrorState } from '../components/LoadingState'

const roiClass = roi =>
  roi >= 2 ? 'text-success bg-success-light border-success' :
  roi >= 1 ? 'text-warning bg-warning-light border-warning' :
             'text-danger bg-danger-light border-danger'

export default function Overview() {
  const { settings, apiKey, buyersApiKey, activeOffers, trackedOffers } = useAppConfig()
  const { getGoals } = useMonthlyGoals()
  const { entries: manualEntries, offerSettings: manualOfferSettings } = useManualEntries()
  const { data, loading, error, refresh }               = useSheetData(activeOffers, settings, apiKey, buyersApiKey)
  const { setRefreshFn }                                = useContext(RefreshContext)
  const [range, setRange]             = useState(getPresetRange('mes_atual'))
  const [todayRate, setTodayRate]     = useState(null)
  const [selectedIds, setSelectedIds] = useState(() => new Set(activeOffers.map(o => o.id)))
  const [dropOpen, setDropOpen]       = useState(false)
  const dropRef                       = useRef(null)

  // Sync selectedIds when offers change (add/remove)
  useEffect(() => {
    setSelectedIds(prev => {
      const validIds = new Set(activeOffers.map(o => o.id))
      const next = new Set([...prev].filter(id => validIds.has(id)))
      return next.size ? next : validIds
    })
  }, [activeOffers])

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropOpen) return
    function handle(e) { if (dropRef.current && !dropRef.current.contains(e.target)) setDropOpen(false) }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [dropOpen])

  useEffect(() => {
    fetchAndCacheRates().then(rates => {
      const getRateForDate = makeGetRate(rates, settings.usdRate)
      const todayKey = new Date().toISOString().split('T')[0]
      setTodayRate(getRateForDate(todayKey))
    })
  }, [settings.usdRate])

  useEffect(() => { setRefreshFn(() => refresh) }, [refresh, setRefreshFn])

  const selectedOffers = useMemo(
    () => activeOffers.filter(o => selectedIds.has(o.id)),
    [activeOffers, selectedIds]
  )
  const allSelected = selectedOffers.length === activeOffers.length

  function toggleOffer(id) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) { if (next.size > 1) next.delete(id) } else next.add(id)
      return next
    })
  }

  function toggleAll() {
    setSelectedIds(allSelected
      ? new Set([activeOffers[0]?.id].filter(Boolean))
      : new Set(activeOffers.map(o => o.id))
    )
  }

  const filteredData = useMemo(() => {
    const result = {}
    selectedOffers.forEach(offer => {
      result[offer.id] = (data[offer.id] || []).filter(r => inRange(r.date, range.start, range.end))
    })
    return result
  }, [data, selectedOffers, range])

  // Somente ofertas que tiveram resultado no período filtrado
  const offersWithResults = useMemo(
    () => selectedOffers.filter(o => (filteredData[o.id] || []).length > 0),
    [selectedOffers, filteredData]
  )

  // Contador de ofertas novas no mês calendário atual
  const { coelhoCount, jnTesteCount } = useMemo(() => {
    const now = new Date()
    const y = now.getFullYear(), m = now.getMonth()
    let coelhoCount = 0, jnTesteCount = 0
    trackedOffers.forEach(o => {
      if (!o.createdAt) return
      const d = new Date(o.createdAt)
      if (d.getFullYear() !== y || d.getMonth() !== m) return
      if (o.status === 'active')   coelhoCount++
      if (o.status === 'testing')  jnTesteCount++
    })
    return { coelhoCount, jnTesteCount }
  }, [trackedOffers])

  const allRows = useMemo(() => Object.values(filteredData).flat(), [filteredData])
  const baseMetrics = useMemo(() => calcMetrics(allRows, settings.aliquota), [allRows, settings.aliquota])

  // Entradas manuais habilitadas para o dash, filtradas pelo período selecionado
  const includedManualEntries = useMemo(() => {
    return manualEntries.filter(e => {
      if (!manualOfferSettings[e.offerName]?.includeInDash) return false
      const d = new Date(e.date + 'T12:00:00')
      return inRange(d, range.start, range.end)
    })
  }, [manualEntries, manualOfferSettings, range])

  const manualTotals = useMemo(() => {
    return includedManualEntries.reduce(
      (acc, e) => {
        const gasto    = e.gasto    ?? e.valorGasto ?? 0
        const faturado = e.faturado ?? 0
        acc.gasto      += gasto
        acc.faturamento += faturado
        acc.comissao   += faturado
        return acc
      },
      { gasto: 0, faturamento: 0, comissao: 0 }
    )
  }, [includedManualEntries])

  const metrics = useMemo(() => {
    if (manualTotals.gasto === 0 && manualTotals.faturamento === 0) return baseMetrics
    const gasto       = baseMetrics.gasto       + manualTotals.gasto
    const faturamento = baseMetrics.faturamento + manualTotals.faturamento
    const comissao    = baseMetrics.comissao    + manualTotals.comissao
    const imposto     = faturamento * (settings.aliquota || 0)
    const lucro_bruto   = comissao - gasto
    const lucro_liquido = comissao - gasto - imposto
    const roi = gasto > 0 ? comissao / gasto : null
    const margem_bruta  = faturamento > 0 ? lucro_bruto / faturamento : null
    const margem_liq    = faturamento > 0 ? lucro_liquido / faturamento : null
    const margem_bruta_comissao = comissao > 0 ? lucro_bruto / comissao : null
    const margem_liq_comissao   = comissao > 0 ? lucro_liquido / comissao : null
    return { ...baseMetrics, gasto, faturamento, comissao, imposto, lucro_bruto, lucro_liquido, roi, margem_bruta, margem_liq, margem_bruta_comissao, margem_liq_comissao }
  }, [baseMetrics, manualTotals, settings.aliquota])

  const dailyRows = useMemo(() => {
    const byDate = {}
    selectedOffers.forEach(offer => {
      ;(filteredData[offer.id] || []).forEach(r => {
        const key = r.date.toISOString().split('T')[0]
        if (!byDate[key]) byDate[key] = { date: r.date, faturamento: 0, comissao: 0, gasto: 0, lucro_bruto: 0, lucro_liquido: 0, offerLucros: {} }
        byDate[key].faturamento   += r.faturamento   || 0
        byDate[key].comissao      += r.comissao      || 0
        byDate[key].gasto         += r.gasto         || 0
        byDate[key].lucro_bruto   += r.lucro_bruto   || 0
        byDate[key].lucro_liquido += r.lucro_liquido || 0
        byDate[key].offerLucros[offer.id] = (byDate[key].offerLucros[offer.id] || 0) + (r.lucro_bruto || 0)
      })
    })
    return Object.values(byDate)
      .sort((a, b) => a.date - b.date)
      .map(r => ({ ...r, roi: r.gasto > 0 ? r.comissao / r.gasto : null }))
  }, [filteredData, selectedOffers])

  const monthRows = useMemo(() => {
    const monthRange = getPresetRange('mes_atual')
    return Object.values(data).flat().filter(r => inRange(r.date, monthRange.start, monthRange.end))
  }, [data])
  const monthLucroLiq = monthRows.reduce((s, r) => s + (r.lucro_liquido || 0), 0)
  const mesKey = getMesAtualKey()
  const { piso: metaPiso, stretch: metaStretch } = getGoals(mesKey, settings.metaPiso, settings.metaStretch)

  if (!apiKey) return <NoApiKey />
  if (loading && !allRows.length) return <Spinner />
  if (error) return <ErrorState message={error} />

  const effectiveRate = todayRate ?? settings.usdRate
  const rateChanged   = todayRate && Math.abs(todayRate - settings.usdRate) > 0.01

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-gray-900">Visão Geral</h2>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <p className="text-xs text-gray-400">Resultado consolidado · todas as ofertas</p>
            {(coelhoCount > 0 || jnTesteCount > 0) && (
              <span className="flex items-center gap-1.5">
                <span className="text-[10px] text-gray-400">novas este mês:</span>
                {coelhoCount > 0 && (
                  <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded-full">
                    {coelhoCount} coelho
                  </span>
                )}
                {jnTesteCount > 0 && (
                  <span className="text-[10px] font-semibold bg-orange-50 text-orange-700 border border-orange-200 px-1.5 py-0.5 rounded-full">
                    {jnTesteCount} JN Teste
                  </span>
                )}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* ── Filtro de ofertas ── */}
          <div className="relative" ref={dropRef}>
            <button
              onClick={() => setDropOpen(p => !p)}
              className="flex items-center gap-1.5 text-xs bg-white border border-gray-200 rounded-lg px-3 py-1.5 shadow-sm hover:border-blue-300 transition-colors"
            >
              <span className="flex items-center gap-1">
                {allSelected ? (
                  <span className="text-gray-500">Todas as ofertas</span>
                ) : (
                  <>
                    {selectedOffers.map(o => (
                      <span key={o.id} className="w-2 h-2 rounded-full" style={{ backgroundColor: o.color }} />
                    ))}
                    <span className="text-gray-700 font-medium">{selectedOffers.length} oferta{selectedOffers.length !== 1 ? 's' : ''}</span>
                  </>
                )}
              </span>
              <ChevronDown className={`w-3 h-3 text-gray-400 transition-transform ${dropOpen ? 'rotate-180' : ''}`} />
            </button>

            {dropOpen && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[200px] py-1">
                {/* Todas */}
                <button
                  onClick={toggleAll}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-gray-50 border-b border-gray-100"
                >
                  <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${allSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}>
                    {allSelected && <Check className="w-2.5 h-2.5 text-white" />}
                  </span>
                  <span className="font-medium text-gray-700">Todas as ofertas</span>
                </button>
                {/* Por oferta */}
                {activeOffers.map(o => {
                  const checked = selectedIds.has(o.id)
                  return (
                    <button
                      key={o.id}
                      onClick={() => toggleOffer(o.id)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-gray-50"
                    >
                      <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${checked ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}>
                        {checked && <Check className="w-2.5 h-2.5 text-white" />}
                      </span>
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: o.color }} />
                      <span className="text-gray-700 truncate">{o.name}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* ── Cotação USD ── */}
          <div
            className="flex items-center gap-1.5 text-xs bg-white border border-gray-200 rounded-lg px-3 py-1.5 shadow-sm"
            title="Cotação automática do fechamento anterior (AwesomeAPI)"
          >
            <span className="text-gray-400">USD</span>
            <span className="font-bold text-gray-700">R$ {effectiveRate.toFixed(2)}</span>
            {rateChanged && (
              <span className="bg-blue-100 text-blue-600 text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase">auto</span>
            )}
          </div>
        </div>
      </div>

      {/* ── Filtro de período ── */}
      <DateFilter onChange={setRange} />

      {/* ── KPIs: inputs (compactos) ── */}
      <div className="grid grid-cols-3 gap-3">
        <KPICard label="Fat. Bruto" value={fmt.brl(metrics.faturamento)} icon={DollarSign} />
        <KPICard label="Comissão"   value={fmt.brl(metrics.comissao)}    icon={DollarSign} />
        <KPICard label="Gasto"      value={fmt.brl(metrics.gasto)}       icon={ShoppingCart} />
      </div>

      {/* ── KPIs: resultado (hero) ── */}
      <div className="grid grid-cols-3 gap-3">
        <KPICard label="Lucro Bruto" value={fmt.brl(metrics.lucro_bruto)}   color={signal('lucro_bruto',   metrics.lucro_bruto)}   icon={TrendingUp} variant="hero" />
        <KPICard label="Lucro Líq."  value={fmt.brl(metrics.lucro_liquido)} color={signal('lucro_liquido', metrics.lucro_liquido)} icon={TrendingUp} variant="hero" />
        <KPICard label="ROI"         value={fmt.roi(metrics.roi)}           color={signal('roi', metrics.roi)} variant="hero" />
      </div>

      {/* ── Margens ── */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-2">
          <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mb-2">Base: Faturamento Bruto</p>
          <div className="grid grid-cols-2 gap-2">
            <KPICard label="Mg Bruta"   value={fmt.pct((metrics.margem_bruta || 0) * 100)} color={signal('margem_bruta', metrics.margem_bruta)} icon={Percent} />
            <KPICard label="Mg Líquida" value={fmt.pct((metrics.margem_liq   || 0) * 100)} color={signal('margem_liq',   metrics.margem_liq)}   icon={Percent} />
          </div>
        </div>
        <div className="bg-purple-50 border border-purple-100 rounded-lg px-4 py-2">
          <p className="text-[10px] font-bold text-purple-500 uppercase tracking-widest mb-2">Base: Comissão</p>
          <div className="grid grid-cols-2 gap-2">
            <KPICard label="Mg Bruta"   value={fmt.pct((metrics.margem_bruta_comissao || 0) * 100)} color={signal('margem_bruta_comissao', metrics.margem_bruta_comissao)} icon={Percent} />
            <KPICard label="Mg Líquida" value={fmt.pct((metrics.margem_liq_comissao   || 0) * 100)} color={signal('margem_liq_comissao',   metrics.margem_liq_comissao)}   icon={Percent} />
          </div>
        </div>
      </div>

      {/* ── Progresso da Meta ── */}
      <GoalProgressBar
        current={monthLucroLiq}
        piso={metaPiso}
        stretch={metaStretch}
        dailyAvg={dailyRows.length > 0 ? metrics.lucro_liquido / dailyRows.length : null}
      />

      {/* ── Gráficos ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <ProfitLineChart rows={dailyRows} />
        <OfferBarChart   offersData={filteredData} offers={offersWithResults} />
        <OfferPieChart   offersData={filteredData} offers={offersWithResults} />
      </div>

{/* ── Detalhe Diário ── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-700">Detalhe Diário</h3>
            <p className="text-xs text-gray-400">{dailyRows.length} {dailyRows.length === 1 ? 'dia' : 'dias'} no período</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-2.5 text-gray-400 font-medium">Data</th>
                {offersWithResults.map(o => (
                  <th key={o.id} className="text-right px-3 py-2.5 text-gray-400 font-medium min-w-[100px]">
                    <span className="inline-flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: o.color }} />
                      {o.name.split('(')[0].trim()}
                    </span>
                  </th>
                ))}
                <th className="text-right px-3 py-2.5 text-gray-400 font-medium min-w-[90px]">Fat. Bruto</th>
                <th className="text-right px-3 py-2.5 text-gray-400 font-medium min-w-[90px]">Comissão</th>
                <th className="text-right px-3 py-2.5 text-gray-400 font-medium min-w-[80px]">Gasto</th>
                <th className="text-right px-3 py-2.5 text-gray-400 font-medium min-w-[90px]">Lucro Bruto</th>
                <th className="text-right px-3 py-2.5 text-gray-400 font-medium min-w-[90px]">Lucro Líq.</th>
                <th className="text-right px-3 py-2.5 text-gray-400 font-medium min-w-[60px]">ROI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {dailyRows.map((row, i) => (
                <tr key={i} className={`hover:bg-gray-50/80 transition-colors ${row.lucro_bruto < 0 ? 'bg-red-50/50' : ''}`}>
                  <td className="px-4 py-2.5 text-gray-600 font-medium">{fmt.date(row.date)}</td>
                  {offersWithResults.map(o => {
                    const v = row.offerLucros?.[o.id] || 0
                    return (
                      <td key={o.id} className="px-3 py-2.5 text-right">
                        <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border ${
                          v > 0 ? 'text-success bg-success-light border-success' :
                          v < 0 ? 'text-danger bg-danger-light border-danger' :
                                  'text-gray-400 bg-gray-50 border-gray-200'
                        }`}>
                          {fmt.brl(v)}
                        </span>
                      </td>
                    )
                  })}
                  <td className="px-3 py-2.5 text-right text-gray-600">{fmt.brl(row.faturamento)}</td>
                  <td className="px-3 py-2.5 text-right text-gray-600">{fmt.brl(row.comissao)}</td>
                  <td className="px-3 py-2.5 text-right text-gray-600">{fmt.brl(row.gasto)}</td>
                  <td className={`px-3 py-2.5 text-right font-semibold ${row.lucro_bruto >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {fmt.brl(row.lucro_bruto)}
                  </td>
                  <td className={`px-3 py-2.5 text-right font-semibold ${row.lucro_liquido >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {fmt.brl(row.lucro_liquido)}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border ${roiClass(row.roi)}`}>
                      {fmt.roi(row.roi)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 border-t-2 border-gray-200 font-semibold">
              <tr>
                <td className="px-4 py-3 text-gray-700">Total</td>
                {offersWithResults.map(o => {
                  const total = (filteredData[o.id] || []).reduce((s, r) => s + (r.lucro_bruto || 0), 0)
                  return <td key={o.id} className="px-3 py-3 text-right text-gray-700">{fmt.brl(total)}</td>
                })}
                <td className="px-3 py-3 text-right text-gray-700">{fmt.brl(metrics.faturamento)}</td>
                <td className="px-3 py-3 text-right text-gray-700">{fmt.brl(metrics.comissao)}</td>
                <td className="px-3 py-3 text-right text-gray-700">{fmt.brl(metrics.gasto)}</td>
                <td className={`px-3 py-3 text-right ${metrics.lucro_bruto >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {fmt.brl(metrics.lucro_bruto)}
                </td>
                <td className={`px-3 py-3 text-right ${metrics.lucro_liquido >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {fmt.brl(metrics.lucro_liquido)}
                </td>
                <td className="px-3 py-3 text-right text-gray-700">{fmt.roi(metrics.roi)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

    </div>
  )
}
