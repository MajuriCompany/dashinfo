import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import { fmt } from '../../utils/formatters'

export default function ProfitLineChart({ rows }) {
  const data = rows.map(r => ({
    date:           fmt.date(r.date),
    Faturamento:    r.faturamento    || 0,
    'Lucro Bruto':  r.lucro_bruto   || 0,
    'Lucro Líquido': r.lucro_liquido || 0,
  }))

  return (
    <div className="bg-white rounded-lg shadow-sm p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Evolução Financeira</h3>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="date" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
          <Tooltip formatter={(v) => fmt.brl(v)} />
          <Legend />
          <Line type="monotone" dataKey="Faturamento"    stroke="#2563eb" dot={false} strokeWidth={2} />
          <Line type="monotone" dataKey="Lucro Bruto"   stroke="#16a34a" dot={false} strokeWidth={2} />
          <Line type="monotone" dataKey="Lucro Líquido" stroke="#9333ea" dot={false} strokeWidth={2} strokeDasharray="5 5" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
