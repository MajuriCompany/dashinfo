import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { fmt } from '../../utils/formatters'

const RADIAN = Math.PI / 180

export default function OfferPieChart({ offersData, offers }) {
  const raw = offers.map(offer => {
    const rows = offersData[offer.id] || []
    const ll   = rows.reduce((s, r) => s + (r.lucro_liquido || 0), 0)
    return { name: offer.name.split('(')[0].trim(), value: ll, color: offer.color }
  }).filter(d => d.value > 0)

  const total = raw.reduce((s, d) => s + d.value, 0)

  if (raw.length === 0 || total === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-4 flex items-center justify-center" style={{ height: 308 }}>
        <p className="text-xs text-gray-400">Sem dados de lucro líquido no período</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-2">% Lucro Líquido por Oferta</h3>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie data={raw} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={false}>
            {raw.map((entry, i) => <Cell key={i} fill={entry.color} />)}
          </Pie>
          <Tooltip formatter={(v, name) => [`${fmt.brl(v)} (${((v / total) * 100).toFixed(1)}%)`, name]} />
        </PieChart>
      </ResponsiveContainer>
      {/* Legenda manual */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
        {raw.map((d, i) => (
          <div key={i} className="flex items-center gap-1.5 text-xs text-gray-600">
            <span className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: d.color }} />
            <span className="font-medium">{d.name}</span>
            <span className="text-gray-400">— {((d.value / total) * 100).toFixed(1)}% · {fmt.brl(d.value)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
