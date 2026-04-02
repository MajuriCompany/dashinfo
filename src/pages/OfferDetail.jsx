import { useState, useEffect, useContext, useMemo } from 'react'
import { DollarSign, TrendingUp, ShoppingCart, MousePointer, Target, Percent } from 'lucide-react'
import { useAppConfig } from '../hooks/useAppConfig'
import { useSheetData } from '../hooks/useSheetData'
import { calcMetrics, signal, SIGNAL_CLASSES } from '../utils/calculations'
import { fmt } from '../utils/formatters'
import { getPresetRange, inRange } from '../utils/dateUtils'
import { RefreshContext } from '../components/Layout'
import KPICard from '../components/KPICard'
import DateFilter from '../components/DateFilter'
import ProfitLineChart from '../components/charts/ProfitLineChart'
import ROIChart from '../components/charts/ROIChart'
import { Spinner, NoApiKey, ErrorState, EmptyState } from '../components/LoadingState'

export default function OfferDetail() {
  const { settings, activeOffers, apiKey, buyersApiKey } = useAppConfig()
  const { data, loading, error, refresh }               = useSheetData(activeOffers, settings, apiKey, buyersApiKey)
  const { setRefreshFn }                                = useContext(RefreshContext)
  const [selectedId, setSelectedId]                     = useState(activeOffers[0]?.id || '')
  const [range, setRange]                               = useState(getPresetRange('mes_atual'))

  useEffect(() => { setRefreshFn(() => refresh) }, [refresh, setRefreshFn])

  const offer = activeOffers.find(o => o.id === selectedId)

  const rows = useMemo(() => {
    return (data[selectedId] || []).filter(r => inRange(r.date, range.start, range.end))
  }, [data, selectedId, range])

  const metrics = useMemo(() => calcMetrics(rows, settings.aliquota), [rows, settings.aliquota])

  if (!apiKey) return <NoApiKey />
  if (loading && !rows.length) return <Spinner />
  if (error) return <ErrorState message={error} />

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-bold text-gray-800">Detalhe por Oferta</h2>
        <select
          value={selectedId}
          onChange={e => setSelectedId(e.target.value)}
          className="border rounded px-3 py-1 text-sm"
        >
          {activeOffers.map(o => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </select>
        {offer && (
          <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: offer.color }} />
        )}
      </div>

      <DateFilter onChange={setRange} />

      {/* Resultado KPIs */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Resultado</p>
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
          <KPICard label="Fat. Bruto"  value={fmt.brl(metrics.faturamento)}   icon={DollarSign} />
          <KPICard label="Comissão"    value={fmt.brl(metrics.comissao)}       icon={DollarSign} />
          <KPICard label="Gasto"       value={fmt.brl(metrics.gasto)}          icon={ShoppingCart} />
          <KPICard label="Lucro Bruto" value={fmt.brl(metrics.lucro_bruto)}   color={signal('lucro_bruto',   metrics.lucro_bruto)}   icon={TrendingUp} />
          <KPICard label="Lucro Líq."  value={fmt.brl(metrics.lucro_liquido)} color={signal('lucro_liquido', metrics.lucro_liquido)} icon={TrendingUp} />
          <KPICard label="ROI"         value={fmt.roi(metrics.roi)}           color={signal('roi', metrics.roi)} />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
          <KPICard label="CPA"          value={fmt.brl(metrics.cpa)}          icon={Target} />
          <KPICard label="AOV"          value={fmt.brl(metrics.aov)}          icon={DollarSign} />
          <KPICard label="Vendas (front)" value={fmt.num(metrics.vendas_front)} icon={ShoppingCart} />
        </div>

        {/* Margens agrupadas por base de cálculo */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-xs font-bold text-blue-600 uppercase tracking-wide mb-2">Base: Faturamento Bruto</p>
            <div className="grid grid-cols-2 gap-2">
              <KPICard label="Mg Bruta"   value={fmt.pct((metrics.margem_bruta || 0) * 100)} color={signal('margem_bruta', metrics.margem_bruta)} icon={Percent} />
              <KPICard label="Mg Líquida" value={fmt.pct((metrics.margem_liq   || 0) * 100)} color={signal('margem_liq',   metrics.margem_liq)}   icon={Percent} />
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
      </div>

      {/* Tráfego KPIs */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Tráfego</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KPICard label="CPC"          value={fmt.brl(metrics.cpc)}     icon={MousePointer} />
          <KPICard label="CPC→IC%"      value={fmt.pct(metrics.cpc_ic)}  color={signal('cpc_ic', metrics.cpc_ic)} />
          <KPICard label="CPI"          value={fmt.brl(metrics.cpi)} />
          <KPICard label="Conv. Checkout%" value={fmt.pct(metrics.conv_checkout)} color={signal('conv_checkout', metrics.conv_checkout)} />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <ProfitLineChart rows={rows} />
        <ROIChart rows={rows} />
      </div>

      {rows.length === 0 ? <EmptyState /> : (
        <div className="bg-white rounded-lg shadow-sm overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['Data','Gasto','CPC','CPC→IC%','CPI','Conv.%','Vendas (front)','AOV','Fat. Bruto','Comissão','CPA','ROI','Lucro Bruto','Lucro Líq.'].map(h => (
                  <th key={h} className="text-right first:text-left px-3 py-2 text-gray-500 whitespace-nowrap min-w-[80px]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className={`border-b hover:bg-gray-50 ${r.lucro_bruto < 0 ? 'bg-red-50' : ''}`}>
                  <td className="px-3 py-2 text-gray-600">{fmt.date(r.date)}</td>
                  <td className="px-3 py-2 text-right text-gray-700">{fmt.brl(r.gasto)}</td>
                  <td className="px-3 py-2 text-right text-gray-700">{fmt.brl(r.cpc)}</td>
                  <td className={`px-3 py-2 text-right`}>
                    <span className={`px-1.5 py-0.5 rounded text-xs border ${SIGNAL_CLASSES[signal('cpc_ic', r.cpc_ic)]}`}>
                      {fmt.pct(r.cpc_ic)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right text-gray-700">{fmt.brl(r.cpi)}</td>
                  <td className="px-3 py-2 text-right">
                    <span className={`px-1.5 py-0.5 rounded text-xs border ${SIGNAL_CLASSES[signal('conv_checkout', r.conv_checkout)]}`}>
                      {fmt.pct(r.conv_checkout)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right text-gray-700">{fmt.num(r.vendas_front)}</td>
                  <td className="px-3 py-2 text-right text-gray-700">{fmt.brl(r.aov)}</td>
                  <td className="px-3 py-2 text-right text-gray-700">{fmt.brl(r.faturamento)}</td>
                  <td className="px-3 py-2 text-right text-gray-700">{fmt.brl(r.comissao)}</td>
                  <td className="px-3 py-2 text-right text-gray-700">{fmt.brl(r.cpa)}</td>
                  <td className="px-3 py-2 text-right">
                    <span className={`px-1.5 py-0.5 rounded text-xs border ${SIGNAL_CLASSES[signal('roi', r.roi)]}`}>
                      {fmt.roi(r.roi)}
                    </span>
                  </td>
                  <td className={`px-3 py-2 text-right font-medium ${r.lucro_bruto >= 0 ? 'text-success' : 'text-danger'}`}>
                    {fmt.brl(r.lucro_bruto)}
                  </td>
                  <td className={`px-3 py-2 text-right font-medium ${r.lucro_liquido >= 0 ? 'text-success' : 'text-danger'}`}>
                    {fmt.brl(r.lucro_liquido)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-100 font-semibold border-t">
              <tr>
                <td className="px-3 py-2 text-gray-700">Total</td>
                <td className="px-3 py-2 text-right">{fmt.brl(metrics.gasto)}</td>
                <td className="px-3 py-2 text-right">{fmt.brl(metrics.cpc)}</td>
                <td className="px-3 py-2 text-right">{fmt.pct(metrics.cpc_ic)}</td>
                <td className="px-3 py-2 text-right">{fmt.brl(metrics.cpi)}</td>
                <td className="px-3 py-2 text-right">{fmt.pct(metrics.conv_checkout)}</td>
                <td className="px-3 py-2 text-right">{fmt.num(metrics.vendas_front)}</td>
                <td className="px-3 py-2 text-right">{fmt.brl(metrics.aov)}</td>
                <td className="px-3 py-2 text-right">{fmt.brl(metrics.faturamento)}</td>
                <td className="px-3 py-2 text-right">{fmt.brl(metrics.comissao)}</td>
                <td className="px-3 py-2 text-right">{fmt.brl(metrics.cpa)}</td>
                <td className="px-3 py-2 text-right">{fmt.roi(metrics.roi)}</td>
                <td className="px-3 py-2 text-right text-success">{fmt.brl(metrics.lucro_bruto)}</td>
                <td className="px-3 py-2 text-right text-success">{fmt.brl(metrics.lucro_liquido)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}
