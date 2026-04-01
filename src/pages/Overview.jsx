import { useState, useEffect, useContext, useMemo } from 'react'
import { DollarSign, TrendingUp, ShoppingCart, Percent } from 'lucide-react'
import { useAppConfig } from '../hooks/useAppConfig'
import { useSheetData } from '../hooks/useSheetData'
import { calcMetrics, signal } from '../utils/calculations'
import { fmt } from '../utils/formatters'
import { getPresetRange, inRange } from '../utils/dateUtils'
import { RefreshContext } from '../components/Layout'
import KPICard from '../components/KPICard'
import DateFilter from '../components/DateFilter'
import GoalProgressBar from '../components/ProgressBar'
import ProfitLineChart from '../components/charts/ProfitLineChart'
import OfferBarChart from '../components/charts/OfferBarChart'
import { Spinner, NoApiKey, ErrorState } from '../components/LoadingState'

export default function Overview() {
  const { settings, apiKey, buyersApiKey, activeOffers } = useAppConfig()
  const { data, loading, error, refresh }               = useSheetData(activeOffers, settings, apiKey, buyersApiKey)
  const { setRefreshFn }                                = useContext(RefreshContext)
  const [range, setRange] = useState(getPresetRange('last_30'))

  useEffect(() => { setRefreshFn(() => refresh) }, [refresh, setRefreshFn])

  const filteredData = useMemo(() => {
    const result = {}
    activeOffers.forEach(offer => {
      result[offer.id] = (data[offer.id] || []).filter(r => inRange(r.date, range.start, range.end))
    })
    return result
  }, [data, activeOffers, range])

  const allRows = useMemo(() =>
    Object.values(filteredData).flat(),
    [filteredData]
  )

  const metrics = useMemo(() => calcMetrics(allRows, settings.aliquota), [allRows, settings.aliquota])

  // Aggregate daily rows across all offers
  const dailyRows = useMemo(() => {
    const byDate = {}
    activeOffers.forEach(offer => {
      (filteredData[offer.id] || []).forEach(r => {
        const key = r.date.toISOString().split('T')[0]
        if (!byDate[key]) byDate[key] = { date: r.date, faturamento: 0, comissao: 0, gasto: 0, lucro_bruto: 0, lucro_liquido: 0, offerLucros: {} }
        byDate[key].faturamento   += r.faturamento  || 0
        byDate[key].comissao      += r.comissao     || 0
        byDate[key].gasto         += r.gasto        || 0
        byDate[key].lucro_bruto   += r.lucro_bruto  || 0
        byDate[key].lucro_liquido += r.lucro_liquido || 0
        byDate[key].offerLucros[offer.id] = (byDate[key].offerLucros[offer.id] || 0) + (r.lucro_bruto || 0)
      })
    })
    return Object.values(byDate)
      .sort((a, b) => a.date - b.date)
      .map(r => ({ ...r, roi: r.gasto > 0 ? r.faturamento / r.gasto : null }))
  }, [filteredData, activeOffers])

  // Month progress for goals
  const monthRows = useMemo(() => {
    const monthRange = getPresetRange('this_month')
    return Object.values(data).flat().filter(r => inRange(r.date, monthRange.start, monthRange.end))
  }, [data])
  const monthLucroBruto = monthRows.reduce((s, r) => s + (r.lucro_bruto || 0), 0)

  if (!apiKey) return <NoApiKey />
  if (loading && !allRows.length) return <Spinner />
  if (error) return <ErrorState message={error} />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-800">Visão Geral</h2>
        <div className="text-xs text-gray-500 bg-white border rounded px-2 py-1">
          USD R$ {settings.usdRate.toFixed(2)}
        </div>
      </div>

      <DateFilter onChange={setRange} />

      {/* KPI Cards — resultado principal */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
        <KPICard label="Fat. Bruto"  value={fmt.brl(metrics.faturamento)}   icon={DollarSign} />
        <KPICard label="Comissão"    value={fmt.brl(metrics.comissao)}       icon={DollarSign} />
        <KPICard label="Gasto"       value={fmt.brl(metrics.gasto)}          icon={ShoppingCart} />
        <KPICard label="Lucro Bruto" value={fmt.brl(metrics.lucro_bruto)}   color={signal('lucro_bruto', metrics.lucro_bruto)}   icon={TrendingUp} />
        <KPICard label="Lucro Líq."  value={fmt.brl(metrics.lucro_liquido)} color={signal('lucro_liquido', metrics.lucro_liquido)} icon={TrendingUp} />
        <KPICard label="ROI"         value={fmt.roi(metrics.roi)}           color={signal('roi', metrics.roi)} />
      </div>

      {/* Margens agrupadas por base de cálculo */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-xs font-bold text-blue-600 uppercase tracking-wide mb-2">Base: Faturamento Bruto</p>
          <div className="grid grid-cols-2 gap-2">
            <KPICard label="Mg Bruta"    value={fmt.pct((metrics.margem_bruta || 0) * 100)} color={signal('margem_bruta', metrics.margem_bruta)} icon={Percent} />
            <KPICard label="Mg Líquida"  value={fmt.pct((metrics.margem_liq   || 0) * 100)} color={signal('margem_liq',   metrics.margem_liq)}   icon={Percent} />
          </div>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
          <p className="text-xs font-bold text-purple-600 uppercase tracking-wide mb-2">Base: Comissão</p>
          <div className="grid grid-cols-2 gap-2">
            <KPICard label="Mg Bruta"   value={fmt.pct((metrics.margem_bruta_comissao || 0) * 100)} color={signal('margem_bruta_comissao', metrics.margem_bruta_comissao)} icon={Percent} />
            <KPICard label="Mg Líquida" value={fmt.pct((metrics.margem_liq_comissao   || 0) * 100)} color={signal('margem_liq_comissao',   metrics.margem_liq_comissao)}   icon={Percent} />
          </div>
        </div>
      </div>

      <GoalProgressBar current={monthLucroBruto} piso={settings.metaPiso} stretch={settings.metaStretch} />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <ProfitLineChart rows={dailyRows} />
        <OfferBarChart   offersData={filteredData} offers={activeOffers} />
      </div>

      {/* Daily Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-3 py-2 text-gray-500">Data</th>
              {activeOffers.map(o => (
                <th key={o.id} className="text-right px-3 py-2 text-gray-500 min-w-[100px]">{o.name.split('(')[0].trim()}</th>
              ))}
              <th className="text-right px-3 py-2 text-gray-500 min-w-[90px]">Fat. Bruto</th>
              <th className="text-right px-3 py-2 text-gray-500 min-w-[90px]">Comissão</th>
              <th className="text-right px-3 py-2 text-gray-500 min-w-[80px]">Gasto</th>
              <th className="text-right px-3 py-2 text-gray-500 min-w-[90px]">Lucro Bruto</th>
              <th className="text-right px-3 py-2 text-gray-500 min-w-[90px]">Lucro Líq.</th>
              <th className="text-right px-3 py-2 text-gray-500 min-w-[60px]">ROI</th>
            </tr>
          </thead>
          <tbody>
            {dailyRows.map((row, i) => (
              <tr
                key={i}
                className={`border-b hover:bg-gray-50 ${row.lucro_bruto < 0 ? 'bg-red-50' : ''}`}
              >
                <td className="px-3 py-2 text-gray-600">{fmt.date(row.date)}</td>
                {activeOffers.map(o => (
                  <td key={o.id} className="px-3 py-2 text-right text-gray-700">
                    {fmt.brl(row.offerLucros?.[o.id] || 0)}
                  </td>
                ))}
                <td className="px-3 py-2 text-right text-gray-700">{fmt.brl(row.faturamento)}</td>
                <td className="px-3 py-2 text-right text-gray-700">{fmt.brl(row.comissao)}</td>
                <td className="px-3 py-2 text-right text-gray-700">{fmt.brl(row.gasto)}</td>
                <td className={`px-3 py-2 text-right font-medium ${row.lucro_bruto >= 0 ? 'text-success' : 'text-danger'}`}>
                  {fmt.brl(row.lucro_bruto)}
                </td>
                <td className={`px-3 py-2 text-right font-medium ${row.lucro_liquido >= 0 ? 'text-success' : 'text-danger'}`}>
                  {fmt.brl(row.lucro_liquido)}
                </td>
                <td className="px-3 py-2 text-right">
                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium border ${
                    row.roi >= 2 ? 'text-success bg-success-light border-success' :
                    row.roi >= 1 ? 'text-warning bg-warning-light border-warning' :
                    'text-danger bg-danger-light border-danger'
                  }`}>
                    {fmt.roi(row.roi)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-gray-100 font-semibold border-t">
            <tr>
              <td className="px-3 py-2 text-gray-700">Total</td>
              {activeOffers.map(o => {
                const total = (filteredData[o.id] || []).reduce((s, r) => s + (r.lucro_bruto || 0), 0)
                return <td key={o.id} className="px-3 py-2 text-right text-gray-700">{fmt.brl(total)}</td>
              })}
              <td className="px-3 py-2 text-right text-gray-700">{fmt.brl(metrics.faturamento)}</td>
              <td className="px-3 py-2 text-right text-gray-700">{fmt.brl(metrics.comissao)}</td>
              <td className="px-3 py-2 text-right text-gray-700">{fmt.brl(metrics.gasto)}</td>
              <td className="px-3 py-2 text-right text-success">{fmt.brl(metrics.lucro_bruto)}</td>
              <td className="px-3 py-2 text-right text-success">{fmt.brl(metrics.lucro_liquido)}</td>
              <td className="px-3 py-2 text-right">{fmt.roi(metrics.roi)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
