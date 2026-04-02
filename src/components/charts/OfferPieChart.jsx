import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { fmt } from '../../utils/formatters'

export default function OfferPieChart({ offersData, offers }) {
  const raw = offers.map(offer => {
    const rows = offersData[offer.id] || []
    const ll   = rows.reduce((s, r) => s + (r.lucro_liquido || 0), 0)
    return { name: offer.name.split('(')[0].trim(), value: ll, color: offer.color }
  }).filter(d => d.value > 0)

  const total = raw.reduce((s, d) => s + d.value, 0)

  if (raw.length === 0 || total === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-4 flex items-center justify-center h-[308px]">
        <p className="text-xs text-gray-400">Sem dados de lucro líquido no período</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">% Lucro Líquido por Oferta</h3>
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie
            data={raw}
            cx="50%"
            cy="50%"
            outerRadius={90}
            dataKey="value"
            label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
            labelLine={false}
          >
            {raw.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(v, name) => [
              `${fmt.brl(v)} (${((v / total) * 100).toFixed(1)}%)`,
              name,
            ]}
          />
          <Legend iconSize={10} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
