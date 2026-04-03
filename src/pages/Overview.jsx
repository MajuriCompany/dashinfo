import { useState, useEffect, useContext, useMemo } from 'react'
import { DollarSign, TrendingUp, ShoppingCart, Percent } from 'lucide-react'
import { useAppConfig } from '../hooks/useAppConfig'
import { useSheetData } from '../hooks/useSheetData'
import { calcMetrics, signal } from '../utils/calculations'
import { fmt } from '../utils/formatters'
import { getPresetRange, getMesAtualKey, inRange } from '../utils/dateUtils'
import { fetchAndCacheRates, makeGetRate } from '../services/exchangeRateService'
import { useMonthlyGoals } from '../hooks/useMonthlyGoals'
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
  const { settings, apiKey, buyersApiKey, activeOffers } = useAppConfig()
  const { getGoals } = useMonthlyGoals()
  const { data, loading, error, refresh }               = useSheetData(activeOffers, settings, apiKey, buyersApiKey)
  const { setRefreshFn }                                = useContext(RefreshContext)
  const [range, setRange] = useState(getPresetRange('mes_atual'))
  const [todayRate, setTodayRate] = useState(null)

  useEffect(() => {
    fetchAndCacheRates().then(rates => {
      const getRateForDate = makeGetRate(rates, settings.usdRate)
      const todayKey = new Date().toISOString().split('T')[0]
      setTodayRate(getRateForDate(todayKey))
    })
  }, [settings.usdRate])

  useEffect(() => { setRefreshFn(() => refresh) }, [refresh, setRefreshFn])

  const filteredData = useMemo(() => {
    const result = {}
    activeOffers.forEach(offer => {
      result[offer.id] = (data[offer.id] || []).filter(r => inRange(r.date, range.start, range.end))
    })
    return result
  }, [data, activeOffers, range])

  const allRows = useMemo(() => Object.values(filteredData).flat(), [filteredData])
  const metrics = useMemo(() => calcMetrics(allRows, settings.aliquota), [allRows, settings.aliquota])

  const dailyRows = useMemo(() => {
    const byDate = {}
    activeOffers.forEach(offer => {
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
  }, [filteredData, activeOffers])

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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Visão Geral</h2>
          <p className="text-xs text-gray-400 mt-0.5">Resultado consolidado · todas as ofertas</p>
        </div>
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
      <GoalProgressBar current={monthLucroLiq} piso={metaPiso} stretch={metaStretch} />

      {/* ── Gráficos ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <ProfitLineChart rows={dailyRows} />
        <OfferBarChart   offersData={filteredData} offers={activeOffers} />
        <OfferPieChart   offersData={filteredData} offers={activeOffers} />
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
                {activeOffers.map(o => (
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
                  {activeOffers.map(o => {
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
                {activeOffers.map(o => {
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
