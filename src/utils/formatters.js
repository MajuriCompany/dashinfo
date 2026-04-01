export const fmt = {
  brl: (v) => {
    if (v == null || isNaN(v)) return '—'
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
  },
  pct: (v, decimals = 1) => {
    if (v == null || isNaN(v)) return '—'
    return `${Number(v).toFixed(decimals)}%`
  },
  roi: (v) => {
    if (v == null || isNaN(v)) return '—'
    return `${Number(v).toFixed(2)}x`
  },
  num: (v, decimals = 0) => {
    if (v == null || isNaN(v)) return '—'
    return Number(v).toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
  },
  date: (d) => {
    if (!d) return '—'
    const date = d instanceof Date ? d : new Date(d)
    return date.toLocaleDateString('pt-BR')
  },
}
