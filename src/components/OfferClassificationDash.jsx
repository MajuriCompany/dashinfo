import { useMemo, useState } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { PieChart as PieIcon } from 'lucide-react'
import { useAppConfig } from '../hooks/useAppConfig'
import { useSheetData } from '../hooks/useSheetData'
import { useManualEntries } from '../hooks/useManualEntries'
import { inRange } from '../utils/dateUtils'
import { fmt } from '../utils/formatters'
import { TIPO_OPTIONS, RESULTADO_OPTIONS, optionLabel } from '../config/offerClassification'

function pct(n, total) {
  return total > 0 ? (n / total) * 100 : 0
}

// ── Filtro de período ─────────────────────────────────────────────────────────

const PERIODS = [
  { key: 'd30',   label: 'Últ. 30d',  days: 30 },
  { key: 'd90',   label: 'Últ. 90d',  days: 90 },
  { key: 'd180',  label: 'Últ. 180d', days: 180 },
  { key: 'total', label: 'Período total' },
]

function periodRange(key) {
  const p = PERIODS.find(x => x.key === key)
  if (!p?.days) return null
  const end   = new Date(); end.setHours(23, 59, 59, 999)
  const start = new Date(); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - (p.days - 1))
  return { start, end }
}

const normName = s => (s || '').trim().toLowerCase()

// Lucro de entrada manual (compat: entradas antigas guardavam lucro direto)
function manualLucro(e) {
  const gasto = e.gasto ?? e.valorGasto ?? null
  if (e.faturado != null && gasto != null) return e.faturado - gasto
  return e.lucro ?? 0
}

// Data de criação usada SÓ neste filtro, quando difere da data de início da oferta (nome normalizado → YYYY-MM-DD)
const CREATED_OVERRIDE = {
  'libido oculta': '2026-03-31',
}

function LucroValue({ value, className = '' }) {
  if (value == null) {
    return (
      <span className="text-gray-300" title="Sem gasto/venda nas planilhas e sem entrada manual com esse nome">
        sem dados
      </span>
    )
  }
  return (
    <span className={`tabular-nums font-semibold ${value >= 0 ? 'text-emerald-600' : 'text-red-500'} ${className}`}>
      {value > 0 ? '+' : ''}{fmt.brl(value)}
    </span>
  )
}

// Lucro da oferta + detalhe (comissão, gasto, imposto) no hover; avisa quando há venda sem gasto
function OfferLucro({ info }) {
  if (!info || info.lucro == null) return <LucroValue value={null} />
  const semGasto = info.comissao > 0 && info.gasto === 0
  const detail = [
    `Comissão: ${fmt.brl(info.comissao)}`,
    `Gasto: ${fmt.brl(info.gasto)}`,
    `Imposto: ${fmt.brl(info.imposto)}`,
    info.manual ? `Entradas manuais: ${fmt.brl(info.manual)}` : null,
    semGasto ? 'Sem gasto nas planilhas: confira a planilha da Meta dessa oferta' : null,
  ].filter(Boolean).join('\n')
  return (
    <span title={detail} className="inline-flex items-center gap-1.5 cursor-help">
      {semGasto && (
        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">sem gasto</span>
      )}
      <LucroValue value={info.lucro} />
    </span>
  )
}

// Conta quantas ofertas caem em cada opção; % sobre as que têm a opção preenchida
function distribution(offers, field, options) {
  const filled = offers.filter(o => options.some(opt => opt.value === o[field]))
  return options.map(opt => {
    const count = filled.filter(o => o[field] === opt.value).length
    return { name: opt.label, color: opt.color, count, pct: pct(count, filled.length) }
  })
}

function DistributionChart({ data }) {
  const slices = data.filter(d => d.count > 0)
  return (
    <div className="flex flex-col sm:flex-row items-center gap-4">
      <div className="w-full sm:w-1/2 h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={slices} dataKey="count" nameKey="name" innerRadius="45%" outerRadius="85%" paddingAngle={2} stroke="none">
              {slices.map(d => <Cell key={d.name} fill={d.color} />)}
            </Pie>
            <Tooltip formatter={(v, _n, item) => [`${v} (${item.payload.pct.toFixed(0)}%)`, item.payload.name]} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      {/* Legenda com quantidade e % */}
      <ul className="w-full sm:w-1/2 space-y-1.5">
        {data.map(d => (
          <li key={d.name} className={`flex items-center gap-2 text-xs ${d.count ? 'text-gray-700' : 'text-gray-300'}`}>
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
            <span className="flex-1 truncate">{d.name}</span>
            <span className="tabular-nums text-gray-400">{d.count}</span>
            <span className="tabular-nums font-semibold w-10 text-right">{d.pct.toFixed(0)}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function OfferClassificationDash() {
  const { offers: allOffers, settings, apiKey, buyersApiKey } = useAppConfig()
  const { entries: manualEntries } = useManualEntries()
  const [tipoFilter, setTipoFilter] = useState('all')
  const [period, setPeriod] = useState('total')

  // Todas as ofertas (inclusive pausadas): planilha de resultado/Meta + compradores (produtos).
  // Busca 4 por vez pra não estourar a cota da API do Google Sheets.
  const { data: sheetData, loading, error: sheetError } = useSheetData(allOffers, settings, apiKey, buyersApiKey, { concurrency: 4 })

  const range = useMemo(() => periodRange(period), [period])

  // Lucro (ou prejuízo) total de cada oferta: planilhas (lucro líquido) + entradas manuais com o mesmo nome
  const lucroById = useMemo(() => {
    const result = {}
    allOffers.forEach(o => {
      let lucro = 0, comissao = 0, gasto = 0, imposto = 0, manual = 0, hasData = false

      ;(sheetData[o.id] || []).forEach(r => {
        if (r.gasto || r.comissao || r.faturamento) hasData = true
        lucro    += r.lucro_liquido || 0
        comissao += r.comissao      || 0
        gasto    += r.gasto         || 0
        imposto  += r.imposto       || 0
      })

      manualEntries.forEach(e => {
        if (normName(e.offerName) !== normName(o.name)) return
        hasData = true
        manual += manualLucro(e)
      })
      lucro += manual

      result[o.id] = { lucro: hasData ? lucro : null, comissao, gasto, imposto, manual }
    })
    return result
  }, [allOffers, sheetData, manualEntries])

  // Filtro de período = data de criação da oferta (data de início em Configurações; senão, data de cadastro)
  const createdAt = o => {
    const override = CREATED_OVERRIDE[normName(o.name)]
    if (override) return new Date(override + 'T12:00:00')
    return o.startDate ? new Date(o.startDate + 'T12:00:00') : (o.createdAt ? new Date(o.createdAt) : null)
  }
  const semData = useMemo(() => allOffers.filter(o => !createdAt(o)).length, [allOffers])

  const offers = useMemo(() => {
    if (!range) return allOffers
    return allOffers.filter(o => {
      const ref = createdAt(o)
      return ref ? inRange(ref, range.start, range.end) : false
    })
  }, [allOffers, range])

  const semTipo      = offers.filter(o => !o.tipo).length
  const semResultado = offers.filter(o => !o.resultado).length

  const byTipo = useMemo(() => distribution(offers, 'tipo', TIPO_OPTIONS), [offers])

  const offersInTipo = useMemo(
    () => tipoFilter === 'all' ? offers : offers.filter(o => o.tipo === tipoFilter),
    [offers, tipoFilter]
  )
  const byResultado = useMemo(() => distribution(offersInTipo, 'resultado', RESULTADO_OPTIONS), [offersInTipo])
  const resultadoTotal = byResultado.reduce((s, d) => s + d.count, 0)

  const RES_ORDER = ['muito_bom', 'bom', 'medio', 'ruim']
  const offerList = useMemo(() => {
    const rank = o => { const i = RES_ORDER.indexOf(o.resultado); return i < 0 ? 99 : i }
    return [...offersInTipo].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name))
  }, [offersInTipo])

  const lucroTotal = offerList.reduce((s, o) => s + (lucroById[o.id]?.lucro ?? 0), 0)
  const lucroLoading = loading && Object.keys(sheetData).length === 0
  const periodLabel = PERIODS.find(p => p.key === period)?.label

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-gray-100 flex-wrap">
        <div>
          <h2 className="font-semibold text-gray-800 flex items-center gap-2">
            <PieIcon className="w-4 h-4 text-gray-500" />
            Agregado de ofertas
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {range
              ? `${offers.length} de ${allOffers.length} ofertas criadas no período`
              : `${allOffers.length} ofertas cadastradas`}
            {' '}· classifique em Configurações → editar oferta
          </p>
          <div className="flex flex-wrap items-center gap-1.5 mt-3">
            {PERIODS.map(p => (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  period === p.key ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-start gap-4">
          {(semTipo > 0 || semResultado > 0 || (range && semData > 0) || sheetError) && (
            <p className="text-[11px] text-amber-600 text-right max-w-[220px]">
              {semTipo > 0 && <span className="block">{semTipo} sem tipo</span>}
              {semResultado > 0 && <span className="block">{semResultado} sem resultado</span>}
              {range && semData > 0 && (
                <span className="block">{semData} sem data de início (fora do filtro) · defina em Configurações</span>
              )}
              {sheetError && <span className="block text-red-500">Erro ao carregar planilhas: {sheetError}</span>}
            </p>
          )}
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wide text-gray-400">
              Lucro · {tipoFilter === 'all' ? 'todos os tipos' : optionLabel(TIPO_OPTIONS, tipoFilter)} · {periodLabel}
            </p>
            <p className="text-lg mt-0.5">
              {lucroLoading ? <span className="text-gray-300 text-sm">carregando…</span> : <LucroValue value={lucroTotal} />}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 p-6">
        {/* Por tipo */}
        <div>
          <p className="text-sm font-semibold text-gray-700 mb-1">Ofertas por tipo</p>
          <p className="text-[11px] text-gray-400 mb-3">
            {byTipo.reduce((s, d) => s + d.count, 0)} ofertas com tipo preenchido
          </p>
          <DistributionChart data={byTipo} />
        </div>

        {/* Resultado por tipo */}
        <div>
          <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
            <p className="text-sm font-semibold text-gray-700">Resultado</p>
            <select
              value={tipoFilter}
              onChange={e => setTipoFilter(e.target.value)}
              className="border rounded-lg px-2 py-1 text-xs"
            >
              <option value="all">Todos os tipos</option>
              {TIPO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <p className="text-[11px] text-gray-400 mb-3">
            {resultadoTotal} {resultadoTotal === 1 ? 'oferta' : 'ofertas'} com resultado
            {tipoFilter !== 'all' && ` · tipo ${TIPO_OPTIONS.find(o => o.value === tipoFilter)?.label}`}
          </p>
          {resultadoTotal === 0 ? (
            <div className="h-[220px] flex items-center justify-center text-xs text-gray-300 italic">
              Nenhuma oferta com resultado nesse tipo
            </div>
          ) : (
            <DistributionChart data={byResultado} />
          )}

          {/* Quais ofertas estão no filtro */}
          {offerList.length > 0 && (
            <div className="mt-4 border border-gray-100 rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-3 py-2 text-gray-500 font-semibold">Oferta</th>
                    {tipoFilter === 'all' && <th className="text-left px-3 py-2 text-gray-500 font-semibold">Tipo</th>}
                    <th className="text-left px-3 py-2 text-gray-500 font-semibold">Resultado</th>
                    <th className="text-right px-3 py-2 text-gray-500 font-semibold">Lucro</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {offerList.map(o => {
                    const res = RESULTADO_OPTIONS.find(r => r.value === o.resultado)
                    return (
                      <tr key={o.id}>
                        <td className="px-3 py-1.5 text-gray-700">
                          <span className="inline-block w-2 h-2 rounded-full mr-2 align-middle" style={{ backgroundColor: o.color }} />
                          {o.name}
                        </td>
                        {tipoFilter === 'all' && (
                          <td className="px-3 py-1.5 text-gray-500">{optionLabel(TIPO_OPTIONS, o.tipo) || <span className="text-gray-300">—</span>}</td>
                        )}
                        <td className="px-3 py-1.5">
                          {res ? (
                            <span className="inline-flex items-center gap-1.5 font-medium" style={{ color: res.color }}>
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: res.color }} />
                              {res.label}
                            </span>
                          ) : <span className="text-gray-300">sem resultado</span>}
                        </td>
                        <td className="px-3 py-1.5 text-right whitespace-nowrap">
                          {lucroLoading ? <span className="text-gray-300">…</span> : <OfferLucro info={lucroById[o.id]} />}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot className="bg-gray-50 border-t border-gray-100">
                  <tr>
                    <td colSpan={tipoFilter === 'all' ? 3 : 2} className="px-3 py-2 text-gray-500 font-semibold">
                      Total · {offerList.length} {offerList.length === 1 ? 'oferta' : 'ofertas'}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      {lucroLoading ? <span className="text-gray-300">…</span> : <LucroValue value={lucroTotal} />}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
