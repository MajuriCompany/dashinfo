import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import { fmt } from '../../utils/formatters'

export default function OfferBarChart({ offersData, offers }) {
  const data = offers.map(offer => {
    const rows = offersData[offer.id] || []
    const fat = rows.reduce((s, r) => s + (r.faturamento || 0), 0)
    const lb  = rows.reduce((s, r) => s + (r.lucro_bruto || 0), 0)
    const ll  = rows.reduce((s, r) => s + (r.lucro_liquido || 0), 0)
    return {
      name:            offer.name.split('(')[0].trim(),
      Faturamento:     fat,
      'Lucro Bruto':   lb,
      'Lucro Líquido': ll,
    }
  })

  return (
    <div className="bg-white rounded-lg shadow-sm p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Comparativo por Oferta</h3>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="name" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
          <Tooltip formatter={v => fmt.brl(v)} />
          <Legend />
          <Bar dataKey="Faturamento"    fill="#2563eb" />
          <Bar dataKey="Lucro Bruto"   fill="#16a34a" />
          <Bar dataKey="Lucro Líquido" fill="#9333ea" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
