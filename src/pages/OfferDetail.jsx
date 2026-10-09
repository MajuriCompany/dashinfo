import { useState, useEffect, useContext, useMemo } from 'react'
import {
  DollarSign, TrendingUp, ShoppingCart, MousePointer, Target, Percent,
  History, GitCompare, Plus, Pencil, Trash2, X, Check, RefreshCw, CalendarRange,
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
import { Spinner, NoApiKey, ErrorState, EmptyState, DataWarnings } from '../components/LoadingState'

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

// Métricas congeladas ao salvar uma anotação com período (todos os produtos, como o filtro "Tudo")
const SNAPSHOT_METRICS = [
  { key: 'gasto',         label: 'Valor gasto',      format: v => fmt.brl(v), lowerBetter: null  },
  { key: 'cpc',           label: 'CPC',              format: v => fmt.brl(v), lowerBetter: true  },
  { key: 'cpc_ic',        label: 'CPC → IC%',        format: v => fmt.pct(v), lowerBetter: false },
  { key: 'cpi',           label: 'Custo/checkout',   format: v => fmt.brl(v), lowerBetter: true  },
  { key: 'conv_checkout', label: 'Conv. Checkout%',  format: v => fmt.pct(v), lowerBetter: false },
  { key: 'vendas_front',  label: 'Vendas (front)',   format: v => fmt.num(v), lowerBetter: false },
  { key: 'roi',           label: 'ROI',              format: v => fmt.roi(v), lowerBetter: false },
]

const EMPTY_HISTORY_FORM = { date: TODAY, note: '', withPeriod: false, start: '', end: '' }

function periodSnapshot(allRows, start, end, aliquota) {
  const rows = allRows.filter(r => inRange(r.date, new Date(start + 'T00:00:00'), new Date(end + 'T23:59:59')))
  const all  = calcMetrics(rows, aliquota)
  const metrics = {}
  SNAPSHOT_METRICS.forEach(x => { metrics[x.key] = all[x.key] ?? null })
  return { start, end, days: rows.length, metrics, savedAt: new Date().toISOString() }
}

function fmtPeriod(snap) {
  return `${fmtDateStr(snap.start)} – ${fmtDateStr(snap.end)} · ${snap.days} ${snap.days === 1 ? 'dia' : 'dias'} com dados`
}

// Uma mudança por linha — vira lista quando tem mais de uma
function NoteText({ note }) {
  const lines = note.split('\n').map(l => l.trim()).filter(Boolean)
  if (lines.length <= 1) return <p className="text-xs text-gray-700 whitespace-pre-wrap">{note}</p>
  return (
    <ul className="text-xs text-gray-700 list-disc pl-4 space-y-0.5">
      {lines.map((l, i) => <li key={i}>{l.replace(/^[-•*]\s*/, '')}</li>)}
    </ul>
  )
}

function MetricsStrip({ metrics }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-1.5 mt-2">
      {SNAPSHOT_METRICS.map(x => (
        <div key={x.key} className="bg-amber-50/60 border border-amber-100 rounded px-2 py-1">
          <p className="text-[10px] text-gray-500 leading-tight">{x.label}</p>
          <p className="text-xs font-semibold text-gray-800">{x.format(metrics[x.key])}</p>
        </div>
      ))}
    </div>
  )
}

function DeltaBadge({ delta, lowerBetter }) {
  if (delta == null) return null
  const improved = lowerBetter != null && (lowerBetter ? delta < 0 : delta > 0)
  const worsened = lowerBetter != null && (lowerBetter ? delta > 0 : delta < 0)
  return (
    <span className={`block text-[10px] font-semibold ${improved ? 'text-green-600' : worsened ? 'text-red-600' : 'text-gray-400'}`}>
      {delta > 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(1)}%
    </span>
  )
}

function calcDeltaPct(a, b) {
  if (b == null || b === 0 || a == null) return null
  return ((a - b) / Math.abs(b)) * 100
}

export default function OfferDetail() {
  const { settings, trackedOffers, apiKey, buyersApiKey } = useAppConfig()
  const { data, productRows, loading, error, warnings, refresh } = useSheetData(trackedOffers, settings, apiKey, buyersApiKey)
  const { setRefreshFn }                                  = useContext(RefreshContext)
  const [selectedId, setSelectedId]                       = useState(trackedOffers[0]?.id || '')
  const [range, setRange]                                 = useState(getPresetRange('mes_atual'))

  // History
  const { history, add: addHistory, update: updateHistory, remove: removeHistory } = useOfferHistory()
  const [showHistory, setShowHistory] = useState(false)
  const [historyForm, setHistoryForm] = useState(EMPTY_HISTORY_FORM)
  const [compareIds, setCompareIds]   = useState(() => new Set())
  const [editingId, setEditingId]     = useState(null)
  const [editForm, setEditForm]       = useState({ date: '', note: '' })

  // Compare
  const [compareMode, setCompareMode]   = useState(false)
  const [rangeBInput, setRangeBInput]   = useState({ start: '', end: '' })
  const [rangeB, setRangeB]             = useState(null)

  // Filtro de produtos: 'all' | 'frontUp1' | 'frontUp2' | 'front'
  const [filterMode, setFilterMode] = useState('all')

  useEffect(() => { setRefreshFn(() => refresh) }, [refresh, setRefreshFn])

  useEffect(() => {
    setHistoryForm(EMPTY_HISTORY_FORM)
    setEditingId(null)
    setCompareIds(new Set())
  }, [selectedId])

  const offer = trackedOffers.find(o => o.id === selectedId)

  const rows = useMemo(() => {
    return (data[selectedId] || []).filter(r => inRange(r.date, range.start, range.end))
  }, [data, selectedId, range])

  const metrics = useMemo(() => calcMetrics(rows, settings.aliquota), [rows, settings.aliquota])

  const up1Name = (offer?.otherProducts || [])[0] || null
  const up2Name = (offer?.otherProducts || [])[1] || null

  const filteredRows = useMemo(() => {
    if (filterMode === 'all') return rows

    const pRows = productRows[selectedId] || []
    const inPeriod = pRows.filter(r => inRange(r.date, range.start, range.end))

    // Sem dados de produto para o período: usa fallback do pipeline para front, devolve tudo para up1/up2
    if (!inPeriod.length) {
      if (filterMode === 'front') {
        return rows.map(r => ({
          ...r,
          comissao:    r.comissao_front    ?? r.comissao,
          faturamento: r.faturamento_front ?? r.faturamento,
          vendas:      r.vendas_front      ?? r.vendas,
        }))
      }
      return rows
    }

    const u1 = (up1Name || '').trim().toLowerCase()
    const u2 = (up2Name || '').trim().toLowerCase()
    const keepFn = {
      front:    r => r.isFront,
      frontUp1: r => r.isFront || (u1 && r.product.trim().toLowerCase() === u1),
      frontUp2: r => r.isFront || (u2 && r.product.trim().toLowerCase() === u2),
    }[filterMode]

    const byDate = {}
    inPeriod.filter(keepFn).forEach(r => {
      const dk = r.date.toISOString().split('T')[0]
      if (!byDate[dk]) byDate[dk] = { comissao: 0, faturamento: 0, faturamento_front: 0, vendas: 0, vendas_front: 0 }
      byDate[dk].comissao    += r.comissao
      byDate[dk].faturamento += r.faturamento
      byDate[dk].vendas      += 1
      if (r.isFront) {
        byDate[dk].vendas_front      += 1
        byDate[dk].faturamento_front += r.faturamento
      }
    })

    return rows.map(r => {
      const dk = r.date.toISOString().split('T')[0]
      const d  = byDate[dk]
      return d
        ? { ...r, ...d }
        : { ...r, comissao: 0, faturamento: 0, faturamento_front: 0, vendas: 0, vendas_front: 0 }
    })
  }, [filterMode, rows, productRows, selectedId, range, up1Name, up2Name])

  const m = useMemo(() => calcMetrics(filteredRows, settings.aliquota), [filteredRows, settings.aliquota])

  const rowsB = useMemo(() => {
    if (!rangeB) return []
    return (data[selectedId] || []).filter(r => inRange(r.date, rangeB.start, rangeB.end))
  }, [data, selectedId, rangeB])

  const metricsB = useMemo(() => calcMetrics(rowsB, settings.aliquota), [rowsB, settings.aliquota])

  const offerHistory = useMemo(() =>
    [...(history[selectedId] || [])].sort((a, b) => b.date.localeCompare(a.date)),
    [history, selectedId]
  )

  const formPeriodValid = historyForm.withPeriod && historyForm.start && historyForm.end && historyForm.start <= historyForm.end

  // Prévia das métricas do período antes de salvar
  const formPreview = useMemo(() => {
    if (!formPeriodValid) return null
    return periodSnapshot(data[selectedId] || [], historyForm.start, historyForm.end, settings.aliquota)
  }, [formPeriodValid, data, selectedId, historyForm.start, historyForm.end, settings.aliquota])

  const canAddHistory = historyForm.note.trim() && (!historyForm.withPeriod || formPreview?.days > 0)

  function handleAddHistory() {
    if (!canAddHistory) return
    addHistory(selectedId, {
      date: historyForm.date,
      note: historyForm.note,
      snapshot: historyForm.withPeriod ? formPreview : undefined,
    })
    setHistoryForm(EMPTY_HISTORY_FORM)
  }

  function handleRecalc(entry) {
    const { start, end } = entry.snapshot
    updateHistory(selectedId, entry.id, { snapshot: periodSnapshot(data[selectedId] || [], start, end, settings.aliquota) })
  }

  function toggleCompare(id) {
    setCompareIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // Períodos marcados para comparar, em ordem cronológica
  const comparedEntries = useMemo(() =>
    offerHistory
      .filter(e => e.snapshot && compareIds.has(e.id))
      .sort((a, b) => a.snapshot.start.localeCompare(b.snapshot.start)),
    [offerHistory, compareIds]
  )

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
      <DataWarnings warnings={warnings} onRetry={refresh} loading={loading} />
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
              rows={3}
              placeholder={'O que foi modificado? Uma mudança por linha. Ex:\nAumentei orçamento de R$100 para R$150/dia\nTroquei o criativo principal'}
              value={historyForm.note}
              onChange={e => setHistoryForm(f => ({ ...f, note: e.target.value }))}
              onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleAddHistory() }}
            />
            <label className="flex items-center gap-2 mt-2 text-xs text-gray-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={historyForm.withPeriod}
                onChange={e => setHistoryForm(f => ({ ...f, withPeriod: e.target.checked }))}
              />
              <CalendarRange className="w-3.5 h-3.5 text-amber-600" />
              Salvar métricas de um período (pra comparar depois)
            </label>
            {historyForm.withPeriod && (
              <div className="mt-2 rounded border border-amber-200 bg-amber-50/50 p-2">
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="date"
                    className="border rounded px-2 py-1 text-xs"
                    value={historyForm.start}
                    onChange={e => setHistoryForm(f => ({ ...f, start: e.target.value }))}
                  />
                  <span className="text-gray-400 text-xs">até</span>
                  <input
                    type="date"
                    className="border rounded px-2 py-1 text-xs"
                    value={historyForm.end}
                    onChange={e => setHistoryForm(f => ({ ...f, end: e.target.value }))}
                  />
                </div>
                {historyForm.start && historyForm.end && historyForm.start > historyForm.end && (
                  <p className="text-xs text-red-600 mt-1.5">A data de início é depois da data de fim.</p>
                )}
                {formPreview && (formPreview.days === 0
                  ? <p className="text-xs text-red-600 mt-1.5">Nenhum dado encontrado nesse período.</p>
                  : <MetricsStrip metrics={formPreview.metrics} />
                )}
              </div>
            )}
            <button
              onClick={handleAddHistory}
              disabled={!canAddHistory}
              className="mt-2 flex items-center gap-1 px-3 py-1.5 bg-amber-500 text-white rounded text-xs font-medium hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Plus className="w-3.5 h-3.5" /> Adicionar
            </button>
          </div>

          {/* Comparação dos períodos marcados */}
          {comparedEntries.length >= 2 && (
            <div className="bg-white rounded-lg border border-amber-200 p-3 mb-3 overflow-x-auto">
              <p className="text-xs font-semibold text-amber-800 mb-2 flex items-center gap-1.5">
                <GitCompare className="w-3.5 h-3.5" />
                Comparando {comparedEntries.length} períodos
                <span className="font-normal text-gray-400">— variação em relação ao período anterior</span>
              </p>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-amber-100">
                    <th className="text-left px-2 py-1.5 text-gray-500 font-semibold align-bottom">Métrica</th>
                    {comparedEntries.map(e => (
                      <th key={e.id} className="text-right px-2 py-1.5 align-bottom min-w-[120px]">
                        <span className="block text-amber-700 font-semibold">
                          {fmtDateStr(e.snapshot.start)} – {fmtDateStr(e.snapshot.end)}
                        </span>
                        <span className="block text-[10px] text-gray-400 font-normal truncate max-w-[180px] ml-auto" title={e.note}>
                          {e.note.split('\n')[0]}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {SNAPSHOT_METRICS.map(x => (
                    <tr key={x.key} className="border-b border-amber-50 last:border-0">
                      <td className="px-2 py-1.5 font-medium text-gray-700">{x.label}</td>
                      {comparedEntries.map((e, i) => {
                        const v     = e.snapshot.metrics[x.key]
                        const prevV = i > 0 ? comparedEntries[i - 1].snapshot.metrics[x.key] : null
                        return (
                          <td key={e.id} className="px-2 py-1.5 text-right text-gray-800">
                            {x.format(v)}
                            {i > 0 && <DeltaBadge delta={calcDeltaPct(v, prevV)} lowerBetter={x.lowerBetter} />}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {offerHistory.some(e => e.snapshot) && comparedEntries.length < 2 && (
            <p className="text-[11px] text-amber-700 mb-2">
              Marque "Comparar" em 2 ou mais anotações com período para ver lado a lado.
            </p>
          )}

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
                        rows={3}
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
                        <NoteText note={entry.note} />
                        {entry.snapshot && (
                          <div className="mt-2 pt-2 border-t border-amber-100">
                            <p className="text-[11px] text-gray-500 flex items-center gap-1">
                              <CalendarRange className="w-3 h-3" />
                              Período: {fmtPeriod(entry.snapshot)}
                            </p>
                            <MetricsStrip metrics={entry.snapshot.metrics} />
                          </div>
                        )}
                      </div>
                      <div className="flex gap-1 shrink-0 items-start">
                        {entry.snapshot && (
                          <>
                            <label className={`flex items-center gap-1 px-2 py-0.5 rounded border text-[11px] cursor-pointer select-none ${
                              compareIds.has(entry.id) ? 'bg-amber-100 border-amber-300 text-amber-800' : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                            }`}>
                              <input
                                type="checkbox"
                                className="w-3 h-3"
                                checked={compareIds.has(entry.id)}
                                onChange={() => toggleCompare(entry.id)}
                              />
                              Comparar
                            </label>
                            <button
                              onClick={() => handleRecalc(entry)}
                              className="p-1 text-gray-400 hover:text-amber-600 rounded"
                              title="Recalcular métricas do período com os dados atuais"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
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
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <p className="text-xs font-semibold text-gray-400 uppercase">Resultado</p>
          <div className="flex gap-0.5 rounded-lg border border-gray-200 p-0.5 bg-gray-50 ml-1">
            {[
              { key: 'all',      label: 'Tudo',     title: 'Todos os produtos' },
              ...(up1Name ? [{ key: 'frontUp1', label: '+Up1', title: up1Name }] : []),
              ...(up2Name ? [{ key: 'frontUp2', label: '+Up2', title: up2Name }] : []),
              { key: 'front',    label: 'Só Front', title: 'Somente produto front, sem upsells' },
            ].map(opt => (
              <button
                key={opt.key}
                onClick={() => setFilterMode(opt.key)}
                title={opt.title}
                className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                  filterMode === opt.key
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {filterMode !== 'all' && (
            <span className="text-[10px] text-gray-400 italic truncate max-w-[200px]">
              {filterMode === 'front'    ? 'sem upsells'           :
               filterMode === 'frontUp1' ? `front + ${up1Name}`    :
               filterMode === 'frontUp2' ? `front + ${up2Name}`    : ''}
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
          <KPICard label="Fat. Bruto"  value={fmt.brl(m.faturamento)}   icon={DollarSign} />
          <KPICard label="Comissão"    value={fmt.brl(m.comissao)}       icon={DollarSign} />
          <KPICard label="Gasto"       value={fmt.brl(metrics.gasto)}    icon={ShoppingCart} />
          <KPICard label="Lucro Bruto" value={fmt.brl(m.lucro_bruto)}   color={signal('lucro_bruto',   m.lucro_bruto)}   icon={TrendingUp} />
          <KPICard label="Lucro Líq."  value={fmt.brl(m.lucro_liquido)} color={signal('lucro_liquido', m.lucro_liquido)} icon={TrendingUp} />
          <KPICard label="ROI"         value={fmt.roi(m.roi)}           color={signal('roi', m.roi)} />
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
              <KPICard label="Mg Bruta"   value={fmt.pct((m.margem_bruta || 0) * 100)} color={signal('margem_bruta', m.margem_bruta)} icon={Percent} />
              <KPICard label="Mg Líquida" value={fmt.pct((m.margem_liq   || 0) * 100)} color={signal('margem_liq',   m.margem_liq)}   icon={Percent} />
            </div>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
            <p className="text-xs font-bold text-purple-600 uppercase tracking-wide mb-2">Base: Comissão</p>
            <div className="grid grid-cols-2 gap-2">
              <KPICard label="Mg Bruta"   value={fmt.pct((m.margem_bruta_comissao || 0) * 100)} color={signal('margem_bruta_comissao', m.margem_bruta_comissao)} icon={Percent} />
              <KPICard label="Mg Líquida" value={fmt.pct((m.margem_liq_comissao   || 0) * 100)} color={signal('margem_liq_comissao',   m.margem_liq_comissao)}   icon={Percent} />
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
