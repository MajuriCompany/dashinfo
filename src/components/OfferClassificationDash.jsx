import { useMemo, useState } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { PieChart as PieIcon } from 'lucide-react'
import { useAppConfig } from '../hooks/useAppConfig'
import { useSheetData } from '../hooks/useSheetData'
import { calcMetrics } from '../utils/calculations'
import { fmt } from '../utils/formatters'
import { TIPO_OPTIONS, RESULTADO_OPTIONS, optionLabel } from '../config/offerClassification'

function pct(n, total) {
  return total > 0 ? (n / total) * 100 : 0
}

// ── Filtro por data de criação da oferta ──────────────────────────────────────

const PERIODS = [
  { key: 'd30',   label: 'Últ. 30d',  days: 30 },
  { key: 'd90',   label: 'Últ. 90d',  days: 90 },
  { key: 'd180',  label: 'Últ. 180d', days: 180 },
  { key: 'total', label: 'Período total' },
]

function periodStart(key) {
  const p = PERIODS.find(x => x.key === key)
  if (!p?.days) return null
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() - (p.days - 1))
  return start
}

// Início da planilha de compradores (mesmo corte do sheetsService) — lucro só conta daqui pra frente
const LUCRO_DESDE = new Date(2026, 2, 31)

// Data de criação usada só neste filtro, quando difere da data de início (nome em minúsculas → YYYY-MM-DD)
const CREATED_OVERRIDE = {
  'libido oculta': '2026-03-31',
}

// Data de início (Configurações) → senão data de cadastro no dash
function offerCreatedAt(o) {
  const override = CREATED_OVERRIDE[(o.name || '').trim().toLowerCase()]
  if (override) return new Date(override + 'T12:00:00')
  if (o.startDate) return new Date(o.startDate + 'T12:00:00')
  if (o.createdAt) return new Date(o.createdAt)
  return null
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
  const { offers: allOffers, settings, apiKey, buyersApiKey, trackedOffers } = useAppConfig()
  const [tipoFilter, setTipoFilter] = useState('all')
  const [period, setPeriod] = useState('total')

  // Mesmo carregamento e mesmo "Lucro Líq." da tela Todas as Ofertas (ofertas não pausadas)
  const { data: sheetData, loading } = useSheetData(trackedOffers, settings, apiKey, buyersApiKey)
  // Só a partir de 31/03/2026: antes disso a planilha de compradores não é lida (só entra gasto, sem venda)
  const lucroById = useMemo(() => {
    const result = {}
    for (const [id, rows] of Object.entries(sheetData)) {
      const desde = rows.filter(r => r.date >= LUCRO_DESDE)
      result[id] = calcMetrics(desde, settings.aliquota).lucro_liquido
    }
    return result
  }, [sheetData, settings.aliquota])

  const start = useMemo(() => periodStart(period), [period])
  const semData = useMemo(() => allOffers.filter(o => !offerCreatedAt(o)).length, [allOffers])

  // Só as ofertas criadas no período (sem data ficam fora dos filtros de dias)
  const offers = useMemo(() => {
    if (!start) return allOffers
    return allOffers.filter(o => {
      const d = offerCreatedAt(o)
      return d ? d >= start : false
    })
  }, [allOffers, start])

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

  const lucroTotal = offerList.reduce((s, o) => s + (lucroById[o.id] ?? 0), 0)
  const lucroLoading = loading && Object.keys(sheetData).length === 0

  function renderLucro(o) {
    if (lucroLoading) return <span className="text-gray-300">…</span>
    const v = lucroById[o.id]
    if (v == null) {
      return (
        <span className="text-gray-300" title={o.status === 'paused' ? 'Oferta pausada: o dash não carrega os dados dela' : 'Sem dados'}>
          —
        </span>
      )
    }
    return (
      <span className={`tabular-nums font-semibold ${v >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
        {fmt.brl(v)}
      </span>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-gray-100 flex-wrap">
        <div>
          <h2 className="font-semibold text-gray-800 flex items-center gap-2">
            <PieIcon className="w-4 h-4 text-gray-500" />
            Agregado de ofertas
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {start
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
        {(semTipo > 0 || semResultado > 0 || (start && semData > 0)) && (
          <p className="text-[11px] text-amber-600 text-right max-w-[220px]">
            {semTipo > 0 && <span className="block">{semTipo} sem tipo</span>}
            {semResultado > 0 && <span className="block">{semResultado} sem resultado</span>}
            {start && semData > 0 && (
              <span className="block">{semData} sem data de início (fora do filtro) · defina em Configurações</span>
            )}
          </p>
        )}
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
                    <th className="text-right px-3 py-2 text-gray-500 font-semibold whitespace-nowrap" title="Lucro líquido desde 31/03/2026, início da planilha de compradores">
                      Lucro Líq. <span className="font-normal text-gray-400">desde 31/03</span>
                    </th>
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
                        <td className="px-3 py-1.5 text-right whitespace-nowrap">{renderLucro(o)}</td>
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
                      {lucroLoading
                        ? <span className="text-gray-400 font-normal">carregando planilhas…</span>
                        : <span className={`tabular-nums font-semibold ${lucroTotal >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{fmt.brl(lucroTotal)}</span>}
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
