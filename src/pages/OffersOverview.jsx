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
import { TrendingUp, ShoppingCart, DollarSign, Percent } from 'lucide-react'
import { useEffect } from 'react'

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

export default function OffersOverview() {
  const { settings, apiKey, buyersApiKey, activeOffers } = useAppConfig()
  const { data, productRows, loading, error, refresh }   = useSheetData(activeOffers, settings, apiKey, buyersApiKey)
  const { setRefreshFn }                                  = useContext(RefreshContext)
  const [range, setRange] = useState(getPresetRange('mes_atual'))

  useEffect(() => { setRefreshFn(() => refresh) }, [refresh, setRefreshFn])

  const filteredData = useMemo(() => {
    const result = {}
    activeOffers.forEach(offer => {
      result[offer.id] = (data[offer.id] || []).filter(r => inRange(r.date, range.start, range.end))
    })
    return result
  }, [data, activeOffers, range])

  if (!apiKey)                         return <NoApiKey />
  if (loading && !Object.keys(data).length) return <Spinner />
  if (error)                           return <ErrorState message={error} />

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
    </div>
  )
}
