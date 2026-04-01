import { SIGNAL_CLASSES } from '../utils/calculations'

export function SignalDot({ color }) {
  const map = {
    green:   'bg-success',
    yellow:  'bg-warning',
    red:     'bg-danger',
    neutral: 'bg-gray-300',
  }
  return <span className={`inline-block w-2 h-2 rounded-full ${map[color] || map.neutral}`} />
}

export function StatusPill({ children, color }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${SIGNAL_CLASSES[color] || SIGNAL_CLASSES.neutral}`}>
      {children}
    </span>
  )
}
