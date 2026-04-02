const borderColor = {
  green:   'border-l-[3px] border-l-emerald-500',
  yellow:  'border-l-[3px] border-l-amber-400',
  red:     'border-l-[3px] border-l-red-400',
  neutral: 'border-l-[3px] border-l-gray-200',
}

const valueColor = {
  green:   'text-emerald-600',
  yellow:  'text-amber-600',
  red:     'text-red-500',
  neutral: 'text-gray-800',
}

export default function KPICard({ label, value, sub, color = 'neutral', icon: Icon, variant = 'default' }) {
  const border = borderColor[color] || borderColor.neutral
  const valCls = valueColor[color]  || valueColor.neutral

  if (variant === 'hero') {
    return (
      <div className={`bg-white rounded-lg shadow-sm border border-gray-100 ${border} px-5 py-4 flex flex-col justify-center`}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">{label}</span>
          {Icon && <Icon className="w-4 h-4 text-gray-300" />}
        </div>
        <div className={`text-2xl font-bold tracking-tight ${valCls}`}>{value}</div>
        {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
      </div>
    )
  }

  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-100 ${border} px-4 py-3 flex flex-col justify-center`}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] font-medium text-gray-400 uppercase tracking-widest">{label}</span>
        {Icon && <Icon className="w-3.5 h-3.5 text-gray-300" />}
      </div>
      <div className="text-xl font-semibold text-gray-700">{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
    </div>
  )
}
