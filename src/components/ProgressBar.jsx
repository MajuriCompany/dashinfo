import { fmt } from '../utils/formatters'

export default function GoalProgressBar({ current, piso, stretch }) {
  const pisoPct    = piso    > 0 ? Math.min((current / piso)    * 100, 100) : 0
  const stretchPct = stretch > 0 ? Math.min((current / stretch) * 100, 100) : 0

  return (
    <div className="bg-white rounded-lg shadow-sm p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Progresso das Metas — Mês atual (Lucro Líquido)</h3>
      <div className="space-y-3">
        <div>
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Meta Piso — {fmt.brl(piso)}</span>
            <span>{pisoPct.toFixed(1)}%</span>
          </div>
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${pisoPct >= 100 ? 'bg-success' : pisoPct >= 60 ? 'bg-warning' : 'bg-danger'}`}
              style={{ width: `${pisoPct}%` }}
            />
          </div>
          <div className="text-xs text-gray-700 mt-0.5 font-medium">{fmt.brl(current)} acumulado</div>
        </div>
        <div>
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Meta Real — {fmt.brl(stretch)}</span>
            <span>{stretchPct.toFixed(1)}%</span>
          </div>
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${stretchPct >= 100 ? 'bg-success' : 'bg-blue-400'}`}
              style={{ width: `${stretchPct}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
