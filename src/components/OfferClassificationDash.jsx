import { useMemo, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList, Cell } from 'recharts'
import { PieChart as PieIcon } from 'lucide-react'
import { useAppConfig } from '../hooks/useAppConfig'
import { TIPO_OPTIONS, RESULTADO_OPTIONS } from '../config/offerClassification'

function pct(n, total) {
  return total > 0 ? (n / total) * 100 : 0
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
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 22, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} />
        <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
        <Tooltip formatter={(v, _n, item) => [`${v} (${item.payload.pct.toFixed(0)}%)`, 'Ofertas']} />
        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
          {data.map(d => <Cell key={d.name} fill={d.color} />)}
          <LabelList
            dataKey="count"
            position="top"
            content={({ x, y, width, index }) => {
              const d = data[index]
              if (!d.count) return null
              return (
                <text x={x + width / 2} y={y - 6} textAnchor="middle" fontSize={10} fontWeight={600} fill="#374151">
                  {d.count} · {d.pct.toFixed(0)}%
                </text>
              )
            }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

export default function OfferClassificationDash() {
  const { offers } = useAppConfig()
  const [tipoFilter, setTipoFilter] = useState('all')

  const semTipo      = offers.filter(o => !o.tipo).length
  const semResultado = offers.filter(o => !o.resultado).length

  const byTipo = useMemo(() => distribution(offers, 'tipo', TIPO_OPTIONS), [offers])

  const offersInTipo = useMemo(
    () => tipoFilter === 'all' ? offers : offers.filter(o => o.tipo === tipoFilter),
    [offers, tipoFilter]
  )
  const byResultado = useMemo(() => distribution(offersInTipo, 'resultado', RESULTADO_OPTIONS), [offersInTipo])
  const resultadoTotal = byResultado.reduce((s, d) => s + d.count, 0)

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <div>
          <h2 className="font-semibold text-gray-800 flex items-center gap-2">
            <PieIcon className="w-4 h-4 text-gray-500" />
            Agregado de ofertas
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {offers.length} ofertas cadastradas · classifique em Configurações → editar oferta
          </p>
        </div>
        {(semTipo > 0 || semResultado > 0) && (
          <p className="text-[11px] text-amber-600 text-right">
            {semTipo > 0 && <span className="block">{semTipo} sem tipo</span>}
            {semResultado > 0 && <span className="block">{semResultado} sem resultado</span>}
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
        </div>
      </div>
    </div>
  )
}
