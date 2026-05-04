import { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts'
import { inRange } from '../../utils/dateUtils'
import { fmt } from '../../utils/formatters'

const COLORS = ['#6366f1','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316','#84cc16']

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-xs space-y-1">
      <p className="font-semibold text-gray-700 max-w-[200px] truncate">{label}</p>
      <p className="text-indigo-600">Vendas: <strong>{d?.vendas}</strong> ({d?.pctVendas?.toFixed(1)}%)</p>
      <p className="text-emerald-600">Faturamento: <strong>{fmt.brl(d?.faturamento)}</strong> ({d?.pctFat?.toFixed(1)}%)</p>
    </div>
  )
}

export default function UpsellChart({ productRows, range }) {
  const data = useMemo(() => {
    if (!productRows?.length) return []
    const filtered = productRows.filter(r => inRange(r.date, range.start, range.end))
    if (!filtered.length) return []

    const agg = {}
    filtered.forEach(r => {
      if (!agg[r.product]) agg[r.product] = { product: r.product, vendas: 0, faturamento: 0, isFront: r.isFront }
      agg[r.product].vendas++
      agg[r.product].faturamento += r.faturamento || 0
    })

    const items      = Object.values(agg)
    const totalVendas = items.reduce((s, p) => s + p.vendas, 0)
    const totalFat   = items.reduce((s, p) => s + p.faturamento, 0)

    return items
      .map(p => ({
        ...p,
        name: p.product,
        pctVendas: totalVendas > 0 ? (p.vendas / totalVendas) * 100 : 0,
        pctFat:    totalFat    > 0 ? (p.faturamento / totalFat)  * 100 : 0,
        totalVendas,
        totalFat,
      }))
      .sort((a, b) => b.pctVendas - a.pctVendas)
  }, [productRows, range])

  if (!data.length) return null

  const totalVendas = data[0]?.totalVendas || 0
  const totalFat    = data[0]?.totalFat    || 0

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm font-semibold text-gray-700">Breakdown por Produto</p>
          <p className="text-[11px] text-gray-400">{totalVendas} vendas · {fmt.brl(totalFat)} faturado</p>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-gray-500">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-indigo-500 shrink-0" />% Vendas</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 shrink-0" />% Faturamento</span>
        </div>
      </div>

      {/* Gráfico de barras */}
      <ResponsiveContainer width="100%" height={Math.max(120, data.length * 52)}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 0, right: 48, left: 8, bottom: 0 }}
          barCategoryGap="30%"
          barGap={3}
        >
          <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
          <YAxis
            type="category"
            dataKey="name"
            width={160}
            tick={{ fontSize: 10, fill: '#6b7280' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={v => v.length > 22 ? v.slice(0, 21) + '…' : v}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f9fafb' }} />
          <Bar dataKey="pctVendas" name="% Vendas" radius={[0, 3, 3, 0]} fill="#6366f1">
            {data.map((_, i) => <Cell key={i} fill={data[i].isFront ? '#6366f1' : '#a5b4fc'} />)}
            <LabelList dataKey="pctVendas" position="right" formatter={v => `${v.toFixed(0)}%`} style={{ fontSize: 10, fill: '#6b7280' }} />
          </Bar>
          <Bar dataKey="pctFat" name="% Faturamento" radius={[0, 3, 3, 0]} fill="#10b981">
            {data.map((_, i) => <Cell key={i} fill={data[i].isFront ? '#10b981' : '#6ee7b7'} />)}
            <LabelList dataKey="pctFat" position="right" formatter={v => `${v.toFixed(0)}%`} style={{ fontSize: 10, fill: '#6b7280' }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Tabela resumo */}
      {(() => {
        const frontVendas = data.find(p => p.isFront)?.vendas ?? 0
        return (
          <div className="mt-3 border-t border-gray-100 pt-3 space-y-2">
            {data.map((p, i) => {
              const txConv = !p.isFront && frontVendas > 0 ? (p.vendas / frontVendas) * 100 : null
              return (
                <div key={p.product} className="flex items-center gap-2 text-xs">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: p.isFront ? COLORS[0] : COLORS[(i % (COLORS.length - 1)) + 1] }}
                  />
                  <span className="flex-1 text-gray-700 truncate" title={p.product}>{p.product}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${p.isFront ? 'bg-indigo-50 text-indigo-600' : 'bg-gray-100 text-gray-500'}`}>
                    {p.isFront ? 'Front' : 'Up/Bump'}
                  </span>
                  {txConv != null && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-amber-50 text-amber-600 whitespace-nowrap">
                      conv. {txConv.toFixed(1)}%
                    </span>
                  )}
                  <span className="text-gray-500 w-16 text-right">{p.vendas} vend.</span>
                  <span className="font-semibold text-indigo-600 w-10 text-right">{p.pctVendas.toFixed(1)}%</span>
                  <span className="text-gray-500 w-20 text-right">{fmt.brl(p.faturamento)}</span>
                  <span className="font-semibold text-emerald-600 w-10 text-right">{p.pctFat.toFixed(1)}%</span>
                </div>
              )
            })}
          </div>
        )
      })()}
    </div>
  )
}
