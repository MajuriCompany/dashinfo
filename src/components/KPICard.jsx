import { SignalDot } from './StatusBadge'

export default function KPICard({ label, value, sub, color = 'neutral', icon: Icon }) {
  const bgMap = {
    green:   'border-l-4 border-success',
    yellow:  'border-l-4 border-warning',
    red:     'border-l-4 border-danger',
    neutral: 'border-l-4 border-gray-200',
  }

  return (
    <div className={`bg-white rounded-lg shadow-sm p-4 ${bgMap[color] || bgMap.neutral}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
        <div className="flex items-center gap-1">
          <SignalDot color={color} />
          {Icon && <Icon className="w-4 h-4 text-gray-400" />}
        </div>
      </div>
      <div className="text-xl font-bold text-gray-900">{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
    </div>
  )
}
