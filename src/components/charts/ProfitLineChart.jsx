import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, LabelList
} from 'recharts'
import { fmt } from '../../utils/formatters'

// Mostra label somente no último ponto da linha
function EndLabel({ x, y, value, fill, index, data }) {
  if (index !== data.length - 1 || value == null) return null
  return (
    <text x={x + 4} y={y - 6} fill={fill} fontSize={9} fontWeight={600} textAnchor="start">
      {`R$${(value / 1000).toFixed(1)}k`}
    </text>
  )
}

export default function ProfitLineChart({ rows }) {
  const data = rows.map(r => ({
    date:            fmt.date(r.date),
    Faturamento:     r.faturamento   || 0,
    'Lucro Líquido': r.lucro_liquido || 0,
  }))

  const makeLabel = (fill) => (props) => <EndLabel {...props} fill={fill} data={data} />

  return (
    <div className="bg-white rounded-lg shadow-sm p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Evolução Financeira</h3>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data} margin={{ right: 50 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="date" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} />
          <Tooltip formatter={v => fmt.brl(v)} />
          <Legend />
          <Line type="monotone" dataKey="Faturamento"    stroke="#2563eb" dot={false} strokeWidth={2}>
            <LabelList content={makeLabel('#2563eb')} />
          </Line>
          <Line type="monotone" dataKey="Lucro Líquido"  stroke="#9333ea" dot={false} strokeWidth={2} strokeDasharray="5 5">
            <LabelList content={makeLabel('#9333ea')} />
          </Line>
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
