export function parseDate(val) {
  if (!val) return null
  if (val instanceof Date) return val

  const n = Number(val)
  if (!isNaN(n) && n > 40000 && n < 60000) {
    return new Date((n - 25569) * 86400 * 1000)
  }

  const s = String(val).trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    // Usar horário LOCAL para evitar offset UTC (ex: no Brasil UTC-3, new Date('2026-04-01')
    // resultaria em 31/03 às 21h local, jogando o dado no dia errado)
    const [y, m, d] = s.split('-').map(Number)
    return new Date(y, m - 1, d)
  }

  const brMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (brMatch) {
    return new Date(Number(brMatch[3]), Number(brMatch[2]) - 1, Number(brMatch[1]))
  }

  return null
}

export function parseNum(val) {
  if (val === null || val === undefined || val === '') return 0
  if (typeof val === 'number') return val
  let s = String(val).trim().replace(/[$R\s%]/g, '').replace('BRL', '')
  if (!s) return 0

  const lastDot   = s.lastIndexOf('.')
  const lastComma = s.lastIndexOf(',')

  if (lastDot > lastComma) {
    // US format: 1,234.56 → remove commas
    s = s.replace(/,/g, '')
  } else if (lastComma > lastDot) {
    // BR format: 1.234,56 → remove dots, comma vira ponto
    s = s.replace(/\./g, '').replace(',', '.')
  }
  // Se só tem um separador e não dá pra saber o formato, deixa como está
  s = s.replace(/[^0-9.\-]/g, '')
  const n = parseFloat(s)
  return isNaN(n) ? 0 : n
}

export function startOfDay(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

export function endOfDay(date) {
  const d = new Date(date)
  d.setHours(23, 59, 59, 999)
  return d
}

export function inRange(date, start, end) {
  if (!date) return false
  return date >= start && date <= end
}

// Retorna a chave "YYYY-MM" do mês comercial de uma data qualquer
export function getCommercialMonthKey(date) {
  let y = date.getFullYear(), m = date.getMonth()
  if (date.getDate() < 3) { m--; if (m < 0) { m = 11; y-- } }
  return `${y}-${String(m + 1).padStart(2, '0')}`
}

// Retorna a chave "YYYY-MM" do mês comercial atual (dia 3 ao dia 2)
export function getMesAtualKey() {
  const today = new Date()
  let y = today.getFullYear(), m = today.getMonth()
  if (today.getDate() < 3) { m--; if (m < 0) { m = 11; y-- } }
  return `${y}-${String(m + 1).padStart(2, '0')}`
}

export function getPresetRange(preset) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const end = endOfDay(new Date())

  switch (preset) {
    case 'today':
      return { start: today, end }
    case 'yesterday': {
      const y = new Date(today)
      y.setDate(y.getDate() - 1)
      return { start: y, end: endOfDay(y) }
    }
    case 'this_week': {
      const s = new Date(today)
      s.setDate(s.getDate() - s.getDay())
      return { start: s, end }
    }
    case 'this_month': {
      const s = new Date(today.getFullYear(), today.getMonth(), 1)
      return { start: s, end }
    }
    case 'last_7':
      return { start: new Date(today.getTime() - 6 * 86400000), end }
    case 'last_30':
      return { start: new Date(today.getTime() - 29 * 86400000), end }
    case 'mes_atual': {
      // Mês comercial: dia 3 ao dia 2 do mês seguinte
      // Se hoje é dia 1 ou 2, ainda estamos no mês comercial anterior
      let y = today.getFullYear(), m = today.getMonth()
      if (today.getDate() < 3) { m--; if (m < 0) { m = 11; y-- } }
      const s = new Date(y, m, 3)
      const e = new Date(y, m + 1, 2)
      return { start: s, end: endOfDay(e) }
    }
    default:
      return { start: new Date(today.getFullYear(), today.getMonth(), 1), end }
  }
}
