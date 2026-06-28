import { useState, useCallback } from 'react'

const TASKS_KEY          = 'dash_tasks'
const SUMMARY_KEY        = 'dash_task_summaries'
const TYPES_KEY          = 'dash_task_types'
const SUMMARY_LABELS_KEY = 'dash_summary_labels'
const OFFERS_TABLE_KEY   = 'dash_offers_table'

const DEFAULT_TYPES = [
  { id: 'reuniao',  label: 'Reunião',  bg: 'bg-blue-500' },
  { id: 'producao', label: 'Produção', bg: 'bg-emerald-500' },
  { id: 'revisao',  label: 'Revisão',  bg: 'bg-amber-500' },
  { id: 'outro',    label: 'Outro',    bg: 'bg-purple-500' },
]

const DEFAULT_SUMMARY_LABELS = [
  { id: 'novaOferta',      emoji: '🆕', label: 'Nova oferta' },
  { id: 'ofertaAjustada',  emoji: '🔧', label: 'Oferta ajustada' },
  { id: 'ofertaOtimizada', emoji: '✅', label: 'Oferta otimizada' },
  { id: 'ofertaEscalada',  emoji: '📈', label: 'Oferta escalada' },
]

function persist(key, value) { localStorage.setItem(key, JSON.stringify(value)) }
function load(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) || fallback } catch { return fallback } }

export function useTaskData() {
  const [tasks,          setTasks]          = useState(() => load(TASKS_KEY,          []))
  const [summaries,      setSummaries]      = useState(() => load(SUMMARY_KEY,        {}))
  const [taskTypes,      setTaskTypes]      = useState(() => load(TYPES_KEY,          DEFAULT_TYPES))
  const [summaryLabels,  setSummaryLabels]  = useState(() => load(SUMMARY_LABELS_KEY, DEFAULT_SUMMARY_LABELS))
  const [offersTable,    setOffersTable]    = useState(() => load(OFFERS_TABLE_KEY,   {}))

  const addTask = useCallback((task) => {
    setTasks(prev => { const next = [...prev, { id: Date.now().toString(), ...task }]; persist(TASKS_KEY, next); return next })
  }, [])

  const updateTask = useCallback((id, fields) => {
    setTasks(prev => { const next = prev.map(t => t.id === id ? { ...t, ...fields } : t); persist(TASKS_KEY, next); return next })
  }, [])

  const removeTask = useCallback((id) => {
    setTasks(prev => { const next = prev.filter(t => t.id !== id); persist(TASKS_KEY, next); return next })
  }, [])

  const updateSummary = useCallback((weekKey, fields) => {
    setSummaries(prev => {
      const next = { ...prev, [weekKey]: { ...(prev[weekKey] || {}), ...fields } }
      persist(SUMMARY_KEY, next)
      return next
    })
  }, [])

  const updateTaskType = useCallback((id, fields) => {
    setTaskTypes(prev => { const next = prev.map(t => t.id === id ? { ...t, ...fields } : t); persist(TYPES_KEY, next); return next })
  }, [])

  const addTaskType = useCallback((label, bg) => {
    setTaskTypes(prev => { const next = [...prev, { id: `type_${Date.now()}`, label, bg }]; persist(TYPES_KEY, next); return next })
  }, [])

  const removeTaskType = useCallback((id) => {
    setTaskTypes(prev => {
      if (prev.length <= 1) return prev
      const next = prev.filter(t => t.id !== id); persist(TYPES_KEY, next); return next
    })
  }, [])

  const updateSummaryLabel = useCallback((id, fields) => {
    setSummaryLabels(prev => { const next = prev.map(l => l.id === id ? { ...l, ...fields } : l); persist(SUMMARY_LABELS_KEY, next); return next })
  }, [])

  const addSummaryLabel = useCallback((emoji, label) => {
    setSummaryLabels(prev => { const next = [...prev, { id: `sl_${Date.now()}`, emoji, label }]; persist(SUMMARY_LABELS_KEY, next); return next })
  }, [])

  const removeSummaryLabel = useCallback((id) => {
    setSummaryLabels(prev => {
      if (prev.length <= 1) return prev
      const next = prev.filter(l => l.id !== id); persist(SUMMARY_LABELS_KEY, next); return next
    })
  }, [])

  const addOffer = useCallback((monthKey) => {
    setOffersTable(prev => {
      const curr = Array.isArray(prev[monthKey]) ? prev[monthKey] : []
      const next = { ...prev, [monthKey]: [...curr, { id: `offer_${Date.now()}`, oferta: '', resultado: '', realizado: '', data: '', obs: '' }] }
      persist(OFFERS_TABLE_KEY, next)
      return next
    })
  }, [])

  const updateOffer = useCallback((monthKey, id, fields) => {
    setOffersTable(prev => {
      const curr = Array.isArray(prev[monthKey]) ? prev[monthKey] : []
      const next = { ...prev, [monthKey]: curr.map(o => o.id === id ? { ...o, ...fields } : o) }
      persist(OFFERS_TABLE_KEY, next)
      return next
    })
  }, [])

  const removeOffer = useCallback((monthKey, id) => {
    setOffersTable(prev => {
      const curr = Array.isArray(prev[monthKey]) ? prev[monthKey] : []
      const next = { ...prev, [monthKey]: curr.filter(o => o.id !== id) }
      persist(OFFERS_TABLE_KEY, next)
      return next
    })
  }, [])

  const reorderOffers = useCallback((monthKey, fromId, toId) => {
    setOffersTable(prev => {
      const curr = Array.isArray(prev[monthKey]) ? prev[monthKey] : []
      const fromIdx = curr.findIndex(o => o.id === fromId)
      const toIdx   = curr.findIndex(o => o.id === toId)
      if (fromIdx === -1 || toIdx === -1) return prev
      const next = [...curr]
      const [removed] = next.splice(fromIdx, 1)
      next.splice(toIdx, 0, removed)
      const result = { ...prev, [monthKey]: next }
      persist(OFFERS_TABLE_KEY, result)
      return result
    })
  }, [])

  return {
    tasks, addTask, updateTask, removeTask,
    summaries, updateSummary,
    taskTypes, updateTaskType, addTaskType, removeTaskType,
    summaryLabels, updateSummaryLabel, addSummaryLabel, removeSummaryLabel,
    offersTable, addOffer, updateOffer, removeOffer, reorderOffers,
  }
}
