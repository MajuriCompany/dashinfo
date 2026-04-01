import { useState } from 'react'
import { Calendar } from 'lucide-react'
import { getPresetRange } from '../utils/dateUtils'

const PRESETS = [
  { key: 'today',      label: 'Hoje' },
  { key: 'yesterday',  label: 'Ontem' },
  { key: 'this_week',  label: 'Esta semana' },
  { key: 'this_month', label: 'Este mês' },
  { key: 'last_7',     label: 'Últimos 7 dias' },
  { key: 'last_30',    label: 'Últimos 30 dias' },
  { key: 'custom',     label: 'Personalizado' },
]

export default function DateFilter({ value, onChange }) {
  const [active, setActive]   = useState('this_month')
  const [custom, setCustom]   = useState({ start: '', end: '' })
  const [showCustom, setShowCustom] = useState(false)

  function selectPreset(key) {
    setActive(key)
    if (key === 'custom') {
      setShowCustom(true)
    } else {
      setShowCustom(false)
      onChange(getPresetRange(key))
    }
  }

  function applyCustom() {
    if (!custom.start || !custom.end) return
    onChange({
      start: new Date(custom.start + 'T00:00:00'),
      end:   new Date(custom.end   + 'T23:59:59'),
    })
    setShowCustom(false)
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-3 flex flex-wrap items-center gap-2">
      <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
      {PRESETS.map(p => (
        <button
          key={p.key}
          onClick={() => selectPreset(p.key)}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
            active === p.key
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          {p.label}
        </button>
      ))}
      {showCustom && (
        <div className="flex items-center gap-2 mt-2 w-full">
          <input
            type="date"
            className="border rounded px-2 py-1 text-xs"
            value={custom.start}
            onChange={e => setCustom(p => ({ ...p, start: e.target.value }))}
          />
          <span className="text-gray-400 text-xs">até</span>
          <input
            type="date"
            className="border rounded px-2 py-1 text-xs"
            value={custom.end}
            onChange={e => setCustom(p => ({ ...p, end: e.target.value }))}
          />
          <button
            onClick={applyCustom}
            className="px-3 py-1 bg-blue-600 text-white rounded text-xs font-medium"
          >
            Aplicar
          </button>
        </div>
      )}
    </div>
  )
}
