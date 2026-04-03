import { useMemo } from 'react'
import { fmt } from '../utils/formatters'
import { getCommercialMonthKey, getMesAtualKey } from '../utils/dateUtils'
import { useMonthlyGoals } from '../hooks/useMonthlyGoals'

const MONTH_LABELS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

function fmtMonth(key) {
  const [y, m] = key.split('-')
  return `${MONTH_LABELS[parseInt(m) - 1]}/${y.slice(2)}`
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

  return (
    <div className="space-y-4">
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
