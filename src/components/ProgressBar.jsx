import { fmt } from '../utils/formatters'

export default function GoalProgressBar({ current, piso, stretch }) {
  const pisoPct    = piso    > 0 ? Math.min((current / piso)    * 100, 100) : 0
  const stretchPct = stretch > 0 ? Math.min((current / stretch) * 100, 100) : 0

  const pisoColor    = pisoPct    >= 100 ? 'bg-emerald-500' : pisoPct    >= 60 ? 'bg-amber-400' : 'bg-red-400'
  const stretchColor = stretchPct >= 100 ? 'bg-emerald-500' : 'bg-blue-400'

  const pisoPctText    = pisoPct    >= 100 ? 'text-emerald-600' : pisoPct    >= 60 ? 'text-amber-600' : 'text-red-500'
  const stretchPctText = stretchPct >= 100 ? 'text-emerald-600' : 'text-blue-500'

  return (
    <div className="bg-white rounded-lg border border-gray-100 shadow-sm px-5 py-3.5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">Metas do Mês · Lucro Líquido</span>
        <span className="text-sm font-bold text-gray-800">{fmt.brl(current)}</span>
      </div>
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-gray-400 w-20 shrink-0">Piso {fmt.brl(piso)}</span>
          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-500 ${pisoColor}`} style={{ width: `${pisoPct}%` }} />
          </div>
          <span className={`text-xs font-bold w-12 text-right tabular-nums ${pisoPctText}`}>{pisoPct.toFixed(1)}%</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-gray-400 w-20 shrink-0">Real {fmt.brl(stretch)}</span>
          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-500 ${stretchColor}`} style={{ width: `${stretchPct}%` }} />
          </div>
          <span className={`text-xs font-bold w-12 text-right tabular-nums ${stretchPctText}`}>{stretchPct.toFixed(1)}%</span>
        </div>
      </div>
    </div>
  )
}
