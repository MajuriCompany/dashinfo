import { useState, useCallback } from 'react'

const TASKS_KEY   = 'dash_tasks'
const SUMMARY_KEY = 'dash_task_summaries'

function loadTasks()     { try { return JSON.parse(localStorage.getItem(TASKS_KEY))   || [] } catch { return [] } }
function loadSummaries() { try { return JSON.parse(localStorage.getItem(SUMMARY_KEY)) || {} } catch { return {} } }

export function useTaskData() {
  const [tasks,     setTasks]     = useState(loadTasks)
  const [summaries, setSummaries] = useState(loadSummaries)

  const addTask = useCallback((task) => {
    setTasks(prev => {
      const next = [...prev, { id: Date.now().toString(), ...task }]
      localStorage.setItem(TASKS_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const updateTask = useCallback((id, fields) => {
    setTasks(prev => {
      const next = prev.map(t => t.id === id ? { ...t, ...fields } : t)
      localStorage.setItem(TASKS_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const removeTask = useCallback((id) => {
    setTasks(prev => {
      const next = prev.filter(t => t.id !== id)
      localStorage.setItem(TASKS_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const updateSummary = useCallback((weekKey, fields) => {
    setSummaries(prev => {
      const next = { ...prev, [weekKey]: { ...(prev[weekKey] || {}), ...fields } }
      localStorage.setItem(SUMMARY_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  return { tasks, addTask, updateTask, removeTask, summaries, updateSummary }
}
