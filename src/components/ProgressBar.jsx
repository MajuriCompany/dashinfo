import { fmt } from '../utils/formatters'

export default function GoalProgressBar({ current, piso, stretch }) {
  const pisoPct    = piso    > 0 ? Math.min((current / piso)    * 100, 100) : 0
  const stretchPct = stretch > 0 ? Math.min((current / stretch) * 100, 100) : 0

  const pisoColor    = pisoPct >= 100 ? 'from-emerald-500 to-emerald-400' : pisoPct >= 60 ? 'from-amber-500 to-amber-400' : 'from-red-500 to-red-400'
  const stretchColor = stretchPct >= 100 ? 'from-emerald-500 to-emerald-400' : 'from-blue-500 to-blue-400'

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-700">Progresso das Metas</h3>
        <span className="text-xs font-semibold text-gray-900 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1">
          {fmt.brl(current)} acumulado
        </span>
      </div>

      <div className="space-y-4">
        <div>
          <div className="flex justify-between items-baseline mb-1.5">
            <span className="text-xs font-medium text-gray-500">Meta Piso</span>
            <div className="flex items-baseline gap-2">
              <span className="text-xs text-gray-400">{fmt.brl(piso)}</span>
              <span className={`text-sm font-bold ${pisoPct >= 100 ? 'text-emerald-600' : pisoPct >= 60 ? 'text-amber-600' : 'text-red-500'}`}>
                {pisoPct.toFixed(1)}%
              </span>
            </div>
          </div>
          <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full bg-gradient-to-r transition-all duration-500 ${pisoColor}`}
              style={{ width: `${pisoPct}%` }}
            />
          </div>
        </div>

        <div>
          <div className="flex justify-between items-baseline mb-1.5">
            <span className="text-xs font-medium text-gray-500">Meta Real</span>
            <div className="flex items-baseline gap-2">
              <span className="text-xs text-gray-400">{fmt.brl(stretch)}</span>
              <span className={`text-sm font-bold ${stretchPct >= 100 ? 'text-emerald-600' : 'text-blue-500'}`}>
                {stretchPct.toFixed(1)}%
              </span>
            </div>
          </div>
          <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full bg-gradient-to-r transition-all duration-500 ${stretchColor}`}
              style={{ width: `${stretchPct}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
