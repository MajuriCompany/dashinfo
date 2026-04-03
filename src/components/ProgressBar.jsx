import { PieChart, Pie, Cell } from 'recharts'
import { fmt } from '../utils/formatters'

function daysLeftInCommercialMonth() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  let y = today.getFullYear(), m = today.getMonth()
  if (today.getDate() < 3) { m--; if (m < 0) { m = 11; y-- } }
  const end = new Date(y, m + 1, 2)
  end.setHours(23, 59, 59, 999)
  const diff = end.getTime() - today.getTime()
  return Math.max(1, Math.ceil(diff / 86400000))
}

function GoalCard({ label, goal, current, fillColor, days }) {
  const falta   = Math.max(goal - current, 0)
  const porDia  = days > 0 ? falta / days : falta
  const filled  = Math.max(current, 0)
  const achieved = current >= goal

  const pieData = achieved
    ? [{ value: 1, color: '#34d399' }]
    : filled > 0
      ? [{ value: filled, color: fillColor }, { value: falta, color: '#f0f0f0' }]
      : [{ value: 1, color: '#f0f0f0' }]

  const pctLabel = goal > 0 ? ((current / goal) * 100).toFixed(1) + '%' : '—'

  return (
    <div className="flex items-center gap-4">
      <div className="relative shrink-0">
        <PieChart width={72} height={72}>
          <Pie
            data={pieData}
            cx={36} cy={36}
            innerRadius={22} outerRadius={33}
            startAngle={90} endAngle={-270}
            dataKey="value"
            strokeWidth={0}
          >
            {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
          </Pie>
        </PieChart>
        <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-gray-500">
          {pctLabel}
        </span>
      </div>

      <div>
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">{label}</p>
        <p className="text-xs text-gray-500 mt-0.5">{fmt.brl(goal)}</p>
        {achieved ? (
          <p className="text-xs font-bold text-emerald-600 mt-1">Atingida!</p>
        ) : (
          <div className="mt-1 space-y-0.5">
            <p className="text-xs text-gray-500">
              Falta{' '}
              <span className="font-semibold text-gray-700">{fmt.brl(falta)}</span>
            </p>
            <p className="text-xs text-gray-400">
              Por dia:{' '}
              <span className="font-semibold text-gray-600">{fmt.brl(porDia)}</span>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default function GoalProgressBar({ current, piso, stretch }) {
  const dias = daysLeftInCommercialMonth()
  const hasPiso    = piso    > 0
  const hasStretch = stretch > 0

  if (!hasPiso && !hasStretch) return null

  return (
    <div className="bg-white rounded-lg border border-gray-100 shadow-sm px-5 py-4">
      <div className="flex items-center justify-between mb-4">
        <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">
          Metas do Mês · Lucro Líquido
        </span>
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-gray-400">
            {dias} dia{dias !== 1 ? 's' : ''} restante{dias !== 1 ? 's' : ''}
          </span>
          <span className="text-sm font-bold text-gray-800">{fmt.brl(current)}</span>
        </div>
      </div>
      <div className={`grid gap-6 ${hasPiso && hasStretch ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {hasPiso    && <GoalCard label="Meta Piso" goal={piso}    current={current} fillColor="#f87171" days={dias} />}
        {hasStretch && <GoalCard label="Meta Real" goal={stretch} current={current} fillColor="#60a5fa" days={dias} />}
      </div>
    </div>
  )
}
