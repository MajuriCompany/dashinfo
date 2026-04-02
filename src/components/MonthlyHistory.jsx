import { useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, Cell, LabelList,
} from 'recharts'
import { fmt } from '../utils/formatters'
import { getCommercialMonthKey, getMesAtualKey } from '../utils/dateUtils'
import { useMonthlyGoals } from '../hooks/useMonthlyGoals'

const MONTH_LABELS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

function fmtMonth(key) {
  const [y, m] = key.split('-')
  return `${MONTH_LABELS[parseInt(m) - 1]}/${y.slice(2)}`
}

function fmtK(v) {
  if (v == null || v === 0) return ''
  return `R$${(v / 1000).toFixed(1)}k`
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs">
      <p className="font-semibold text-gray-700 mb-1.5">{label}</p>
      <p className="text-gray-600">Lucro Líq.: <span className="font-bold">{fmt.brl(d.lucro_liquido)}</span></p>
      {d.piso    > 0 && <p className="text-gray-500">Meta Piso: {fmt.brl(d.piso)} · <span className={d.pisoAchieved >= 100 ? 'text-emerald-600 font-bold' : d.pisoAchieved >= 60 ? 'text-amber-600 font-bold' : 'text-red-500 font-bold'}>{d.pisoAchieved?.toFixed(1)}%</span></p>}
      {d.stretch > 0 && <p className="text-gray-500">Meta Real: {fmt.brl(d.stretch)} · <span className={d.stretchAchieved >= 100 ? 'text-emerald-600 font-bold' : 'text-blue-500 font-bold'}>{d.stretchAchieved?.toFixed(1)}%</span></p>}
    </div>
  )
}

export default function MonthlyHistory({ data, settings }) {
  const { getGoals, goals } = useMonthlyGoals()
  const mesAtual = getMesAtualKey()

  const months = useMemo(() => {
    const byMonth = {}

    Object.values(data).flat().forEach(row => {
      if (!row.date) return
      const key = getCommercialMonthKey(row.date)
      if (!byMonth[key]) byMonth[key] = { key, lucro_liquido: 0, lucro_bruto: 0, faturamento: 0, gasto: 0, comissao: 0 }
      byMonth[key].lucro_liquido += row.lucro_liquido || 0
      byMonth[key].lucro_bruto  += row.lucro_bruto  || 0
      byMonth[key].faturamento  += row.faturamento  || 0
      byMonth[key].gasto        += row.gasto        || 0
      byMonth[key].comissao     += row.comissao     || 0
    })

    return Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, d]) => {
        const { piso, stretch } = getGoals(key, settings.metaPiso, settings.metaStretch)
        return {
          ...d,
          label:           fmtMonth(key),
          piso,
          stretch,
          isCurrent:       key === mesAtual,
          pisoAchieved:    piso    > 0 ? (d.lucro_liquido / piso)    * 100 : null,
          stretchAchieved: stretch > 0 ? (d.lucro_liquido / stretch) * 100 : null,
        }
      })
  }, [data, settings, getGoals, goals, mesAtual])

  if (months.length === 0) return null

  // Barra colorida por resultado vs meta piso
  function barFill(d) {
    if (d.isCurrent)           return '#93c5fd' // azul (em andamento)
    if (d.lucro_liquido < 0)   return '#f87171' // vermelho
    if (!d.piso)               return '#6ee7b7' // verde padrão
    if (d.pisoAchieved >= 100) return '#34d399' // verde forte
    if (d.pisoAchieved >= 60)  return '#fbbf24' // âmbar
    return '#f87171'                             // vermelho
  }

  // Linha de referência usa o piso do mês mais recente ou global
  const lastMonth   = months[months.length - 1]
  const refPiso     = lastMonth?.piso    || 0
  const refStretch  = lastMonth?.stretch || 0

  return (
    <div className="space-y-4">
      {/* ── Gráfico de barras mensal ── */}
      <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-700">Lucro Líquido por Mês</h3>
            <p className="text-xs text-gray-400 mt-0.5">Barras azuis = mês em andamento</p>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-gray-400">
            <span className="flex items-center gap-1"><span className="inline-block w-5 border-t-2 border-dashed border-emerald-400" /> Meta Piso</span>
            <span className="flex items-center gap-1"><span className="inline-block w-5 border-t-2 border-dashed border-blue-400" /> Meta Real</span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={months} margin={{ top: 20, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} axisLine={false} tickLine={false} width={50} />
            <Tooltip content={<CustomTooltip />} />
            {refPiso    > 0 && <ReferenceLine y={refPiso}    stroke="#34d399" strokeDasharray="5 4" strokeWidth={1.5} />}
            {refStretch > 0 && <ReferenceLine y={refStretch} stroke="#60a5fa" strokeDasharray="5 4" strokeWidth={1.5} />}
            <Bar dataKey="lucro_liquido" radius={[4, 4, 0, 0]} maxBarSize={52}>
              <LabelList dataKey="lucro_liquido" position="top" formatter={fmtK} style={{ fontSize: 9, fontWeight: 600, fill: '#6b7280' }} />
              {months.map((d, i) => <Cell key={i} fill={barFill(d)} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── Tabela mensal ── */}
      <div className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700">Histórico por Mês</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-2.5 text-gray-400 font-medium">Mês</th>
                <th className="text-right px-3 py-2.5 text-gray-400 font-medium">Fat. Bruto</th>
                <th className="text-right px-3 py-2.5 text-gray-400 font-medium">Comissão</th>
                <th className="text-right px-3 py-2.5 text-gray-400 font-medium">Gasto</th>
                <th className="text-right px-3 py-2.5 text-gray-400 font-medium">Lucro Líq.</th>
                <th className="text-right px-3 py-2.5 text-gray-400 font-medium">Meta Piso</th>
                <th className="text-right px-3 py-2.5 text-gray-400 font-medium">% Piso</th>
                <th className="text-right px-3 py-2.5 text-gray-400 font-medium">Meta Real</th>
                <th className="text-right px-3 py-2.5 text-gray-400 font-medium">% Real</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {[...months].reverse().map((m, i) => {
                const pisoCls    = m.pisoAchieved    == null ? 'text-gray-400' : m.pisoAchieved    >= 100 ? 'text-emerald-600 font-bold' : m.pisoAchieved    >= 60 ? 'text-amber-600 font-semibold' : 'text-red-500 font-semibold'
                const stretchCls = m.stretchAchieved == null ? 'text-gray-400' : m.stretchAchieved >= 100 ? 'text-emerald-600 font-bold' : 'text-blue-500 font-semibold'
                const llCls = m.lucro_liquido >= 0 ? 'text-emerald-600 font-semibold' : 'text-red-500 font-semibold'
                return (
                  <tr key={i} className={`hover:bg-gray-50/80 transition-colors ${m.isCurrent ? 'bg-blue-50/50' : ''}`}>
                    <td className="px-4 py-2.5 font-medium text-gray-700">
                      {m.label}
                      {m.isCurrent && <span className="ml-2 text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded font-semibold uppercase">em andamento</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right text-gray-600">{fmt.brl(m.faturamento)}</td>
                    <td className="px-3 py-2.5 text-right text-gray-600">{fmt.brl(m.comissao)}</td>
                    <td className="px-3 py-2.5 text-right text-gray-600">{fmt.brl(m.gasto)}</td>
                    <td className={`px-3 py-2.5 text-right ${llCls}`}>{fmt.brl(m.lucro_liquido)}</td>
                    <td className="px-3 py-2.5 text-right text-gray-500">{m.piso    > 0 ? fmt.brl(m.piso)    : '—'}</td>
                    <td className={`px-3 py-2.5 text-right ${pisoCls}`}>{m.pisoAchieved    != null ? `${m.pisoAchieved.toFixed(1)}%`    : '—'}</td>
                    <td className="px-3 py-2.5 text-right text-gray-500">{m.stretch > 0 ? fmt.brl(m.stretch) : '—'}</td>
                    <td className={`px-3 py-2.5 text-right ${stretchCls}`}>{m.stretchAchieved != null ? `${m.stretchAchieved.toFixed(1)}%` : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
