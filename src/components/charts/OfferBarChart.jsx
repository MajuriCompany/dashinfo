import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, LabelList
} from 'recharts'
import { fmt } from '../../utils/formatters'

const labelStyle = { fontSize: 9, fontWeight: 600 }

export default function OfferBarChart({ offersData, offers }) {
  const data = offers.map(offer => {
    const rows = offersData[offer.id] || []
    const fat = rows.reduce((s, r) => s + (r.faturamento    || 0), 0)
    const ll  = rows.reduce((s, r) => s + (r.lucro_liquido  || 0), 0)
    return {
      name:            offer.name.split('(')[0].trim(),
      Faturamento:     fat,
      'Lucro Líquido': ll,
    }
  })

  const fmt$ = v => v !== 0 ? `R$${(v / 1000).toFixed(1)}k` : ''

  return (
    <div className="bg-white rounded-lg shadow-sm p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Comparativo por Oferta</h3>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 20, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="name" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} />
          <Tooltip formatter={v => fmt.brl(v)} />
          <Legend />
          <Bar dataKey="Faturamento" fill="#2563eb">
            <LabelList dataKey="Faturamento"    position="top" formatter={fmt$} style={{ ...labelStyle, fill: '#1d4ed8' }} />
          </Bar>
          <Bar dataKey="Lucro Líquido" fill="#9333ea">
            <LabelList dataKey="Lucro Líquido"  position="top" formatter={fmt$} style={{ ...labelStyle, fill: '#6b21a8' }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
