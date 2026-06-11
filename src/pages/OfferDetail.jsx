import { useState, useEffect, useContext, useMemo } from 'react'
import {
  DollarSign, TrendingUp, ShoppingCart, MousePointer, Target, Percent,
  History, GitCompare, Plus, Pencil, Trash2, X, Check,
} from 'lucide-react'
import { useAppConfig } from '../hooks/useAppConfig'
import { useSheetData } from '../hooks/useSheetData'
import { useOfferHistory } from '../hooks/useOfferHistory'
import { calcMetrics, signal, SIGNAL_CLASSES } from '../utils/calculations'
import { fmt } from '../utils/formatters'
import { getPresetRange, inRange } from '../utils/dateUtils'
import { RefreshContext } from '../components/Layout'
import KPICard from '../components/KPICard'
import DateFilter from '../components/DateFilter'
import ProfitLineChart from '../components/charts/ProfitLineChart'
import ROIChart from '../components/charts/ROIChart'
import UpsellChart from '../components/charts/UpsellChart'
import { Spinner, NoApiKey, ErrorState, EmptyState } from '../components/LoadingState'

const TODAY = new Date().toISOString().slice(0, 10)

function fmtDateStr(str) {
  return new Date(str + 'T12:00:00').toLocaleDateString('pt-BR')
}

const COMPARE_METRICS = [
  { key: 'cpc',           label: 'CPC',              format: v => fmt.brl(v),  lowerBetter: true  },
  { key: 'cpi',           label: 'CPI (fin. compra)',format: v => fmt.brl(v),  lowerBetter: true  },
  { key: 'cpc_ic',        label: 'CPC → IC%',        format: v => fmt.pct(v),  lowerBetter: false },
  { key: 'conv_checkout', label: 'Conv. Checkout%',  format: v => fmt.pct(v),  lowerBetter: false },
  { key: 'roi',           label: 'ROI',              format: v => fmt.roi(v),  lowerBetter: false },
]

function calcDeltaPct(a, b) {
  if (b == null || b === 0 || a == null) return null
  return ((a - b) / Math.abs(b)) * 100
}

export default function OfferDetail() {
  const { settings, trackedOffers, apiKey, buyersApiKey } = useAppConfig()
  const { data, productRows, loading, error, refresh }    = useSheetData(trackedOffers, settings, apiKey, buyersApiKey)
  const { setRefreshFn }                                  = useContext(RefreshContext)
  const [selectedId, setSelectedId]                       = useState(trackedOffers[0]?.id || '')
  const [range, setRange]                                 = useState(getPresetRange('mes_atual'))

  // History
  const { history, add: addHistory, update: updateHistory, remove: removeHistory } = useOfferHistory()
  const [showHistory, setShowHistory] = useState(false)
  const [historyForm, setHistoryForm] = useState({ date: TODAY, note: '' })
  const [editingId, setEditingId]     = useState(null)
  const [editForm, setEditForm]       = useState({ date: '', note: '' })

  // Compare
  const [compareMode, setCompareMode]   = useState(false)
  const [rangeBInput, setRangeBInput]   = useState({ start: '', end: '' })
  const [rangeB, setRangeB]             = useState(null)

  useEffect(() => { setRefreshFn(() => refresh) }, [refresh, setRefreshFn])

  useEffect(() => {
    setHistoryForm({ date: TODAY, note: '' })
    setEditingId(null)
  }, [selectedId])

  const offer = trackedOffers.find(o => o.id === selectedId)

  const rows = useMemo(() => {
    return (data[selectedId] || []).filter(r => inRange(r.date, range.start, range.end))
  }, [data, selectedId, range])

  const metrics = useMemo(() => calcMetrics(rows, settings.aliquota), [rows, settings.aliquota])

  const rowsB = useMemo(() => {
    if (!rangeB) return []
    return (data[selectedId] || []).filter(r => inRange(r.date, rangeB.start, rangeB.end))
  }, [data, selectedId, rangeB])

  const metricsB = useMemo(() => calcMetrics(rowsB, settings.aliquota), [rowsB, settings.aliquota])

  const offerHistory = useMemo(() =>
    [...(history[selectedId] || [])].sort((a, b) => b.date.localeCompare(a.date)),
    [history, selectedId]
  )

  function handleAddHistory() {
    if (!historyForm.note.trim()) return
    addHistory(selectedId, historyForm)
    setHistoryForm({ date: TODAY, note: '' })
  }

  function handleStartEdit(entry) {
    setEditingId(entry.id)
    setEditForm({ date: entry.date, note: entry.note })
  }

  function handleSaveEdit() {
    if (!editForm.note.trim()) return
    updateHistory(selectedId, editingId, editForm)
    setEditingId(null)
  }

  function handleApplyCompare() {
    if (!rangeBInput.start || !rangeBInput.end) return
    setRangeB({
      start: new Date(rangeBInput.start + 'T00:00:00'),
      end:   new Date(rangeBInput.end   + 'T23:59:59'),
    })
  }

  if (!apiKey) return <NoApiKey />
  if (loading && !rows.length) return <Spinner />
  if (error) return <ErrorState message={error} />

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="text-lg font-bold text-gray-800">Detalhe por Oferta</h2>
        <select
          value={selectedId}
          onChange={e => setSelectedId(e.target.value)}
          className="border rounded px-3 py-1 text-sm"
        >
          {trackedOffers.map(o => (
            <option key={o.id} value={o.id}>
              {o.name}{o.status === 'testing' ? ' (em teste)' : ''}
            </option>
          ))}
        </select>
        {offer && (
          <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: offer.color }} />
        )}
        <div className="ml-auto flex gap-2">
          <button
            onClick={() => setShowHistory(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              showHistory
                ? 'bg-amber-100 text-amber-700 border-amber-300'
                : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            Histórico
            {offerHistory.length > 0 && (
              <span className="bg-amber-500 text-white rounded-full px-1.5 py-0.5 text-[10px] leading-none">
                {offerHistory.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setCompareMode(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              compareMode
                ? 'bg-blue-100 text-blue-700 border-blue-300'
                : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200'
            }`}
          >
            <GitCompare className="w-3.5 h-3.5" />
            Comparar períodos
          </button>
        </div>
      </div>

      <DateFilter onChange={setRange} />

      {/* ── History Panel ───────────────────────────────────── */}
      {showHistory && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <h3 className="text-sm font-bold text-amber-800 mb-3 flex items-center gap-2">
            <History className="w-4 h-4" />
            Histórico de modificações — {offer?.name}
          </h3>

          {/* Add form */}
          <div className="bg-white rounded-lg border border-amber-200 p-3 mb-3">
            <p className="text-xs font-semibold text-gray-500 mb-2">Nova entrada</p>
            <input
              type="date"
              className="border rounded px-2 py-1 text-xs mb-2"
              value={historyForm.date}
              onChange={e => setHistoryForm(f => ({ ...f, date: e.target.value }))}
            />
            <textarea
              className="w-full border rounded px-2 py-1.5 text-xs resize-none"
              rows={2}
              placeholder="O que foi modificado? Ex: Aumentei orçamento de R$100 para R$150/dia"
              value={historyForm.note}
              onChange={e => setHistoryForm(f => ({ ...f, note: e.target.value }))}
              onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleAddHistory() }}
            />
            <button
              onClick={handleAddHistory}
              disabled={!historyForm.note.trim()}
              className="mt-2 flex items-center gap-1 px-3 py-1.5 bg-amber-500 text-white rounded text-xs font-medium hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Plus className="w-3.5 h-3.5" /> Adicionar
            </button>
          </div>

          {/* Entries */}
          {offerHistory.length === 0 ? (
            <p className="text-xs text-amber-600 italic text-center py-2">Nenhuma entrada ainda.</p>
          ) : (
            <div className="space-y-2">
              {offerHistory.map(entry => (
                <div key={entry.id} className="bg-white rounded-lg border border-amber-100 p-3">
                  {editingId === entry.id ? (
                    <div className="space-y-2">
                      <input
                        type="date"
                        className="border rounded px-2 py-1 text-xs"
                        value={editForm.date}
                        onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))}
                      />
                      <textarea
                        className="w-full border rounded px-2 py-1.5 text-xs resize-none"
                        rows={2}
                        value={editForm.note}
                        onChange={e => setEditForm(f => ({ ...f, note: e.target.value }))}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={handleSaveEdit}
                          className="flex items-center gap-1 px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                        >
                          <Check className="w-3 h-3" /> Salvar
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="flex items-center gap-1 px-2 py-1 bg-gray-200 text-gray-600 rounded text-xs hover:bg-gray-300"
                        >
                          <X className="w-3 h-3" /> Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-amber-700 mb-1">{fmtDateStr(entry.date)}</p>
                        <p className="text-xs text-gray-700 whitespace-pre-wrap">{entry.note}</p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button
                          onClick={() => handleStartEdit(entry)}
                          className="p-1 text-gray-400 hover:text-blue-600 rounded"
                          title="Editar"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => removeHistory(selectedId, entry.id)}
                          className="p-1 text-gray-400 hover:text-red-600 rounded"
                          title="Excluir"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Compare Panel ───────────────────────────────────── */}
      {compareMode && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-sm font-bold text-blue-800 mb-3 flex items-center gap-2">
            <GitCompare className="w-4 h-4" />
            Comparação de Períodos
          </h3>

          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="bg-white border border-blue-200 rounded-lg px-3 py-2">
              <p className="text-[10px] text-blue-500 font-semibold uppercase mb-0.5">Período A (filtro acima)</p>
              <p className="text-xs text-gray-600">{rows.length} {rows.length === 1 ? 'dia' : 'dias'} com dados</p>
            </div>

            <span className="text-gray-400 font-bold text-sm">vs</span>

            <div className="bg-white border border-blue-200 rounded-lg px-3 py-2">
              <p className="text-[10px] text-blue-500 font-semibold uppercase mb-1.5">Período B</p>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="date"
                  className="border rounded px-2 py-1 text-xs"
                  value={rangeBInput.start}
                  onChange={e => setRangeBInput(r => ({ ...r, start: e.target.value }))}
                />
                <span className="text-gray-400 text-xs">até</span>
                <input
                  type="date"
                  className="border rounded px-2 py-1 text-xs"
                  value={rangeBInput.end}
                  onChange={e => setRangeBInput(r => ({ ...r, end: e.target.value }))}
                />
                <button
                  onClick={handleApplyCompare}
                  disabled={!rangeBInput.start || !rangeBInput.end}
                  className="px-3 py-1 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Comparar
                </button>
              </div>
            </div>
          </div>

          {rangeB && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs bg-white rounded-lg border border-blue-100 overflow-hidden">
                <thead>
                  <tr className="bg-blue-100">
                    <th className="text-left px-4 py-2.5 text-blue-700 font-semibold">Métrica</th>
                    <th className="text-right px-4 py-2.5 text-blue-700 font-semibold">Período A</th>
                    <th className="text-right px-4 py-2.5 text-blue-700 font-semibold">Período B</th>
                    <th className="text-right px-4 py-2.5 text-blue-700 font-semibold">Variação</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARE_METRICS.map(m => {
                    const vA      = metrics[m.key]
                    const vB      = metricsB[m.key]
                    const delta   = calcDeltaPct(vA, vB)
                    const improved = delta != null && (m.lowerBetter ? delta < 0 : delta > 0)
                    const worsened = delta != null && (m.lowerBetter ? delta > 0 : delta < 0)
                    return (
                      <tr key={m.key} className="border-t border-blue-50 hover:bg-blue-50/40">
                        <td className="px-4 py-2.5 font-medium text-gray-700">{m.label}</td>
                        <td className="px-4 py-2.5 text-right text-gray-800 font-medium">{m.format(vA)}</td>
                        <td className="px-4 py-2.5 text-right text-gray-500">{m.format(vB)}</td>
                        <td className="px-4 py-2.5 text-right">
                          {delta == null ? (
                            <span className="text-gray-400">—</span>
                          ) : (
                            <span className={`font-semibold ${
                              improved ? 'text-green-600' : worsened ? 'text-red-600' : 'text-gray-500'
                            }`}>
                              {delta > 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(1)}%
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {rowsB.length === 0 && (
                <p className="text-xs text-center text-blue-500 mt-2 italic">
                  Nenhum dado encontrado para o Período B.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Resultado KPIs ──────────────────────────────────── */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Resultado</p>
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
          <KPICard label="Fat. Bruto"  value={fmt.brl(metrics.faturamento)}   icon={DollarSign} />
          <KPICard label="Comissão"    value={fmt.brl(metrics.comissao)}       icon={DollarSign} />
          <KPICard label="Gasto"       value={fmt.brl(metrics.gasto)}          icon={ShoppingCart} />
          <KPICard label="Lucro Bruto" value={fmt.brl(metrics.lucro_bruto)}   color={signal('lucro_bruto',   metrics.lucro_bruto)}   icon={TrendingUp} />
          <KPICard label="Lucro Líq."  value={fmt.brl(metrics.lucro_liquido)} color={signal('lucro_liquido', metrics.lucro_liquido)} icon={TrendingUp} />
          <KPICard label="ROI"         value={fmt.roi(metrics.roi)}           color={signal('roi', metrics.roi)} />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
          <KPICard label="CPA"            value={fmt.brl(metrics.cpa)}          icon={Target} />
          <KPICard label="AOV"            value={fmt.brl(metrics.aov)}          icon={DollarSign} />
          <KPICard label="Vendas (front)" value={fmt.num(metrics.vendas_front)} icon={ShoppingCart} />
        </div>

        {/* Margens agrupadas por base de cálculo */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-xs font-bold text-blue-600 uppercase tracking-wide mb-2">Base: Faturamento Bruto</p>
            <div className="grid grid-cols-2 gap-2">
              <KPICard label="Mg Bruta"   value={fmt.pct((metrics.margem_bruta || 0) * 100)} color={signal('margem_bruta', metrics.margem_bruta)} icon={Percent} />
              <KPICard label="Mg Líquida" value={fmt.pct((metrics.margem_liq   || 0) * 100)} color={signal('margem_liq',   metrics.margem_liq)}   icon={Percent} />
            </div>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
            <p className="text-xs font-bold text-purple-600 uppercase tracking-wide mb-2">Base: Comissão</p>
            <div className="grid grid-cols-2 gap-2">
              <KPICard label="Mg Bruta"   value={fmt.pct((metrics.margem_bruta_comissao || 0) * 100)} color={signal('margem_bruta_comissao', metrics.margem_bruta_comissao)} icon={Percent} />
              <KPICard label="Mg Líquida" value={fmt.pct((metrics.margem_liq_comissao   || 0) * 100)} color={signal('margem_liq_comissao',   metrics.margem_liq_comissao)}   icon={Percent} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Tráfego KPIs ────────────────────────────────────── */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Tráfego</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KPICard label="CPC"             value={fmt.brl(metrics.cpc)}          icon={MousePointer} />
          <KPICard label="CPC→IC%"         value={fmt.pct(metrics.cpc_ic)}       color={signal('cpc_ic', metrics.cpc_ic)} />
          <KPICard label="CPI"             value={fmt.brl(metrics.cpi)} />
          <KPICard label="Conv. Checkout%" value={fmt.pct(metrics.conv_checkout)} color={signal('conv_checkout', metrics.conv_checkout)} />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <ProfitLineChart rows={rows} />
        <ROIChart rows={rows} />
      </div>

      {(productRows[selectedId]?.length > 0) && (
        <UpsellChart productRows={productRows[selectedId]} range={range} />
      )}

      {rows.length === 0 ? <EmptyState /> : (
        <div className="bg-white rounded-lg shadow-sm overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['Data','Gasto','CPC','CPC→IC%','CPI','Conv.%','Vendas (front)','AOV','Fat. Bruto','Comissão','CPA','ROI','Lucro Bruto','Lucro Líq.'].map(h => (
                  <th key={h} className="text-right first:text-left px-3 py-2 text-gray-500 whitespace-nowrap min-w-[80px]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className={`border-b hover:bg-gray-50 ${r.lucro_bruto < 0 ? 'bg-red-50' : ''}`}>
                  <td className="px-3 py-2 text-gray-600">{fmt.date(r.date)}</td>
                  <td className="px-3 py-2 text-right text-gray-700">{fmt.brl(r.gasto)}</td>
                  <td className="px-3 py-2 text-right text-gray-700">{fmt.brl(r.cpc)}</td>
                  <td className="px-3 py-2 text-right">
                    <span className={`px-1.5 py-0.5 rounded text-xs border ${SIGNAL_CLASSES[signal('cpc_ic', r.cpc_ic)]}`}>
                      {fmt.pct(r.cpc_ic)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right text-gray-700">{fmt.brl(r.cpi)}</td>
                  <td className="px-3 py-2 text-right">
                    <span className={`px-1.5 py-0.5 rounded text-xs border ${SIGNAL_CLASSES[signal('conv_checkout', r.conv_checkout)]}`}>
                      {fmt.pct(r.conv_checkout)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right text-gray-700">{fmt.num(r.vendas_front)}</td>
                  <td className="px-3 py-2 text-right text-gray-700">{fmt.brl(r.aov)}</td>
                  <td className="px-3 py-2 text-right text-gray-700">{fmt.brl(r.faturamento)}</td>
                  <td className="px-3 py-2 text-right text-gray-700">{fmt.brl(r.comissao)}</td>
                  <td className="px-3 py-2 text-right text-gray-700">{fmt.brl(r.cpa)}</td>
                  <td className="px-3 py-2 text-right">
                    <span className={`px-1.5 py-0.5 rounded text-xs border ${SIGNAL_CLASSES[signal('roi', r.roi)]}`}>
                      {fmt.roi(r.roi)}
                    </span>
                  </td>
                  <td className={`px-3 py-2 text-right font-medium ${r.lucro_bruto >= 0 ? 'text-success' : 'text-danger'}`}>
                    {fmt.brl(r.lucro_bruto)}
                  </td>
                  <td className={`px-3 py-2 text-right font-medium ${r.lucro_liquido >= 0 ? 'text-success' : 'text-danger'}`}>
                    {fmt.brl(r.lucro_liquido)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-100 font-semibold border-t">
              <tr>
                <td className="px-3 py-2 text-gray-700">Total</td>
                <td className="px-3 py-2 text-right">{fmt.brl(metrics.gasto)}</td>
                <td className="px-3 py-2 text-right">{fmt.brl(metrics.cpc)}</td>
                <td className="px-3 py-2 text-right">{fmt.pct(metrics.cpc_ic)}</td>
                <td className="px-3 py-2 text-right">{fmt.brl(metrics.cpi)}</td>
                <td className="px-3 py-2 text-right">{fmt.pct(metrics.conv_checkout)}</td>
                <td className="px-3 py-2 text-right">{fmt.num(metrics.vendas_front)}</td>
                <td className="px-3 py-2 text-right">{fmt.brl(metrics.aov)}</td>
                <td className="px-3 py-2 text-right">{fmt.brl(metrics.faturamento)}</td>
                <td className="px-3 py-2 text-right">{fmt.brl(metrics.comissao)}</td>
                <td className="px-3 py-2 text-right">{fmt.brl(metrics.cpa)}</td>
                <td className="px-3 py-2 text-right">{fmt.roi(metrics.roi)}</td>
                <td className="px-3 py-2 text-right text-success">{fmt.brl(metrics.lucro_bruto)}</td>
                <td className="px-3 py-2 text-right text-success">{fmt.brl(metrics.lucro_liquido)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}
