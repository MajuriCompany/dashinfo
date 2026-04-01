export function signal(metric, value) {
  if (value == null || isNaN(value)) return 'neutral'
  switch (metric) {
    case 'roi':
      return value >= 2 ? 'green' : value >= 1 ? 'yellow' : 'red'
    case 'lucro_bruto':
    case 'lucro_liquido':
      return value > 0 ? 'green' : 'red'
    case 'margem_bruta':
      return value >= 0.30 ? 'green' : value >= 0.15 ? 'yellow' : 'red'
    case 'margem_liq':
      return value >= 0.20 ? 'green' : value >= 0.08 ? 'yellow' : 'red'
    case 'margem_bruta_comissao':
      return value >= 0.50 ? 'green' : value >= 0.25 ? 'yellow' : 'red'
    case 'margem_liq_comissao':
      return value >= 0.35 ? 'green' : value >= 0.15 ? 'yellow' : 'red'
    case 'conv_checkout':
      return value >= 15 ? 'green' : value >= 8 ? 'yellow' : 'red'
    case 'cpc_ic':
      return value >= 20 ? 'green' : value >= 10 ? 'yellow' : 'red'
    default:
      return 'neutral'
  }
}

export const SIGNAL_CLASSES = {
  green:   'text-success bg-success-light border-success',
  yellow:  'text-warning bg-warning-light border-warning',
  red:     'text-danger bg-danger-light border-danger',
  neutral: 'text-gray-600 bg-gray-50 border-gray-200',
}

export function calcMetrics(rows, aliquota) {
  const totals = rows.reduce(
    (acc, r) => {
      acc.faturamento       += r.faturamento       || 0
      acc.faturamento_front += r.faturamento_front || 0
      acc.comissao          += r.comissao          || 0
      acc.gasto             += r.gasto             || 0
      acc.vendas            += r.vendas            || 0
      acc.vendas_front      += r.vendas_front      || 0
      acc.checkouts         += r.checkouts         || 0
      acc.clicks            += r.clicks            || 0
      return acc
    },
    { faturamento: 0, faturamento_front: 0, comissao: 0, gasto: 0, vendas: 0, vendas_front: 0, checkouts: 0, clicks: 0 }
  )

  // Imposto calculado sobre faturamento BRUTO
  const imposto       = totals.faturamento * (aliquota || 0)
  const lucro_bruto   = totals.comissao - totals.gasto
  const lucro_liquido = totals.comissao - totals.gasto - imposto
  const roi           = totals.gasto > 0 ? totals.comissao / totals.gasto : null
  const cpa           = totals.vendas_front > 0 ? totals.gasto / totals.vendas_front : null
  const aov           = totals.vendas_front > 0 ? totals.comissao / totals.vendas_front : null
  const cpc           = totals.clicks > 0 ? totals.gasto / totals.clicks : null
  const cpc_ic        = totals.clicks > 0 ? (totals.checkouts / totals.clicks) * 100 : null
  const cpi           = totals.checkouts > 0 ? totals.gasto / totals.checkouts : null
  // conv_checkout usa vendas_front (só produto principal, não bumps/upsells)
  const vendas_conv   = totals.vendas_front > 0 ? totals.vendas_front : totals.vendas
  const conv_checkout = totals.checkouts > 0 ? (vendas_conv / totals.checkouts) * 100 : null
  // Margens: base = faturamento bruto
  const margem_bruta  = totals.faturamento > 0 ? lucro_bruto / totals.faturamento : null
  const margem_liq    = totals.faturamento > 0 ? lucro_liquido / totals.faturamento : null
  // Margens: base = comissão
  const margem_bruta_comissao = totals.comissao > 0 ? lucro_bruto / totals.comissao : null
  const margem_liq_comissao   = totals.comissao > 0 ? lucro_liquido / totals.comissao : null

  return {
    ...totals,
    imposto,
    lucro_bruto,
    lucro_liquido,
    roi,
    cpa,
    aov,
    cpc,
    cpc_ic,
    cpi,
    conv_checkout,
    margem_bruta,
    margem_liq,
    margem_bruta_comissao,
    margem_liq_comissao,
  }
}

export function enrichRow(row, aliquota) {
  const faturamento        = row.faturamento       || 0
  const faturamento_front  = row.faturamento_front || 0
  const comissao           = row.comissao          || 0
  const gasto         = row.gasto       || 0
  const imposto       = faturamento * (aliquota || 0)
  const lucro_bruto   = comissao - gasto
  const lucro_liquido = comissao - gasto - imposto
  const roi           = gasto > 0 ? comissao / gasto : null
  const cpa           = row.vendas_front > 0 ? gasto / row.vendas_front : null
  const aov           = row.vendas_front > 0 ? comissao / row.vendas_front : null
  const margem_bruta  = faturamento > 0 ? lucro_bruto / faturamento : null
  const margem_liq    = faturamento > 0 ? lucro_liquido / faturamento : null
  const margem_bruta_comissao = comissao > 0 ? lucro_bruto / comissao : null
  const margem_liq_comissao   = comissao > 0 ? lucro_liquido / comissao : null

  return {
    ...row,
    imposto,
    lucro_bruto,
    lucro_liquido,
    roi,
    cpa,
    aov,
    margem_bruta,
    margem_liq,
    margem_bruta_comissao,
    margem_liq_comissao,
  }
}
