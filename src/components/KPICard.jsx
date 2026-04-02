const colorStyles = {
  green:   { value: 'text-emerald-600', icon: 'bg-emerald-50 text-emerald-500', hero: 'bg-emerald-50 border-emerald-200' },
  yellow:  { value: 'text-amber-600',   icon: 'bg-amber-50 text-amber-500',     hero: 'bg-amber-50 border-amber-200' },
  red:     { value: 'text-red-500',     icon: 'bg-red-50 text-red-400',         hero: 'bg-red-50 border-red-200' },
  neutral: { value: 'text-gray-800',    icon: 'bg-gray-100 text-gray-400',      hero: 'bg-white border-gray-200' },
}

export default function KPICard({ label, value, sub, color = 'neutral', icon: Icon, variant = 'default' }) {
  const c = colorStyles[color] || colorStyles.neutral

  if (variant === 'hero') {
    return (
      <div className={`rounded-xl border p-5 ${c.hero}`}>
        <div className="flex items-start justify-between mb-4">
          <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest leading-tight">{label}</span>
          {Icon && (
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${c.icon}`}>
              <Icon className="w-4 h-4" />
            </div>
          )}
        </div>
        <div className={`text-2xl font-bold tracking-tight ${c.value}`}>{value}</div>
        {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">{label}</span>
        {Icon && (
          <div className="w-6 h-6 rounded-md bg-gray-50 flex items-center justify-center">
            <Icon className="w-3.5 h-3.5 text-gray-400" />
          </div>
        )}
      </div>
      <div className="text-xl font-semibold text-gray-700">{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
    </div>
  )
}
