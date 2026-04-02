import { useState, useCallback } from 'react'

const KEY = 'dash_monthly_goals'

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {} } catch { return {} }
}

export function useMonthlyGoals() {
  const [goals, setGoalsState] = useState(load)

  const setGoals = useCallback((monthKey, piso, stretch) => {
    setGoalsState(prev => {
      const next = { ...prev, [monthKey]: { piso: Number(piso), stretch: Number(stretch) } }
      localStorage.setItem(KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const removeGoals = useCallback((monthKey) => {
    setGoalsState(prev => {
      const next = { ...prev }
      delete next[monthKey]
      localStorage.setItem(KEY, JSON.stringify(next))
      return next
    })
  }, [])

  // Retorna metas do mês, com fallback para os valores globais de settings
  function getGoals(monthKey, defaultPiso, defaultStretch) {
    const g = goals[monthKey]
    return {
      piso:    g?.piso    ?? defaultPiso,
      stretch: g?.stretch ?? defaultStretch,
    }
  }

  return { goals, setGoals, removeGoals, getGoals }
}
