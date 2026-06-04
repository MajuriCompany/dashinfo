import { useState, useCallback } from 'react'

const TASKS_KEY   = 'dash_tasks'
const SUMMARY_KEY = 'dash_task_summaries'
const TYPES_KEY   = 'dash_task_types'

const DEFAULT_TYPES = [
  { id: 'reuniao',  label: 'Reunião',  bg: 'bg-blue-500' },
  { id: 'producao', label: 'Produção', bg: 'bg-emerald-500' },
  { id: 'revisao',  label: 'Revisão',  bg: 'bg-amber-500' },
  { id: 'outro',    label: 'Outro',    bg: 'bg-purple-500' },
]

function persist(key, value) { localStorage.setItem(key, JSON.stringify(value)) }
function load(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) || fallback } catch { return fallback } }

export function useTaskData() {
  const [tasks,     setTasks]     = useState(() => load(TASKS_KEY,   []))
  const [summaries, setSummaries] = useState(() => load(SUMMARY_KEY, {}))
  const [taskTypes, setTaskTypes] = useState(() => load(TYPES_KEY,   DEFAULT_TYPES))

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
      const next = prev.filter(t => t.id !== id)
      persist(TYPES_KEY, next)
      return next
    })
  }, [])

  return {
    tasks, addTask, updateTask, removeTask,
    summaries, updateSummary,
    taskTypes, updateTaskType, addTaskType, removeTaskType,
  }
}
