import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, Cell, ResponsiveContainer
} from 'recharts'
import { fmt } from '../../utils/formatters'

export default function ROIChart({ rows }) {
  const data = rows.map(r => ({
    date: fmt.date(r.date),
    roi:  r.roi || 0,
  }))

  function getColor(roi) {
    if (roi >= 2) return '#16a34a'
    if (roi >= 1) return '#ca8a04'
    return '#dc2626'
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">ROI por Dia</h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="date" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${v.toFixed(1)}x`} />
          <Tooltip formatter={v => fmt.roi(v)} />
          <ReferenceLine y={1} stroke="#ca8a04" strokeDasharray="4 4" label={{ value: '1x', fontSize: 10 }} />
          <ReferenceLine y={2} stroke="#16a34a" strokeDasharray="4 4" label={{ value: '2x', fontSize: 10 }} />
          <Bar dataKey="roi">
            {data.map((entry, i) => (
              <Cell key={i} fill={getColor(entry.roi)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
