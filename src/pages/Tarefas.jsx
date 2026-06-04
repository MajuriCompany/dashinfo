import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { ChevronLeft, ChevronRight, X, ClipboardList, CheckCircle2, Circle, Plus, Pencil, Trash2, Check } from 'lucide-react'
import { getISOWeek, getISOWeekYear, startOfISOWeek, addWeeks, addDays, format } from 'date-fns'
import { useTaskData } from '../hooks/useTaskData'

const SLOT_HEIGHT = 36
const START_HOUR  = 6
const END_HOUR    = 23
const TOTAL_SLOTS = (END_HOUR - START_HOUR) * 2  // 34 slots (06:00 → 23:00)

const DAYS_PT = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

const SUMMARY_CATS = [
  { id: 'novaOferta',      emoji: '🆕', label: 'Nova oferta criada' },
  { id: 'ofertaAjustada',  emoji: '🔧', label: 'Oferta ajustada' },
  { id: 'ofertaOtimizada', emoji: '✅', label: 'Oferta otimizada' },
  { id: 'ofertaEscalada',  emoji: '📈', label: 'Oferta escalada' },
]

const COLOR_OPTIONS = [
  'bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-purple-500',
  'bg-red-500',  'bg-pink-500',    'bg-cyan-500',  'bg-indigo-500',
  'bg-teal-500', 'bg-orange-500',
]

function clamp(min, max, val) { return Math.min(max, Math.max(min, val)) }

function getWeekKey(date) {
  return `${getISOWeekYear(date)}-W${String(getISOWeek(date)).padStart(2, '0')}`
}

function slotToTime(slot) {
  const mins = START_HOUR * 60 + slot * 30
  const h = Math.floor(mins / 60), m = mins % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

// ── Modal ────────────────────────────────────────────────────────────────────

function TaskModal({ initial, taskTypes, onSave, onDelete, onClose }) {
  const startSlot = initial?.startSlot ?? 0
  const [title,   setTitle]   = useState(initial?.title ?? '')
  const [typeId,  setTypeId]  = useState(initial?.type  ?? (taskTypes[0]?.id ?? ''))
  const [endSlot, setEndSlot] = useState(
    initial?.endSlot ?? Math.min(startSlot + 2, TOTAL_SLOTS)
  )
  const minEnd = startSlot + 1

  function handleSave() {
    if (!title.trim()) return
    onSave({ title: title.trim(), type: typeId, endSlot })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl p-5 w-80 space-y-4 z-10">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-800">{initial?.id ? 'Editar tarefa' : 'Nova tarefa'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">Título</label>
          <input
            autoFocus
            value={title}
            onChange={e => setTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
            placeholder="Ex: Call com cliente..."
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">Tipo</label>
          <div className="flex gap-2 flex-wrap">
            {taskTypes.map(t => (
              <button
                key={t.id}
                onClick={() => setTypeId(t.id)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  typeId === t.id ? `${t.bg} text-white` : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">
            Início: {slotToTime(startSlot)} — Término:
          </label>
          <select
            value={endSlot}
            onChange={e => setEndSlot(Number(e.target.value))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {Array.from({ length: TOTAL_SLOTS - minEnd + 1 }, (_, i) => minEnd + i).map(s => (
              <option key={s} value={s}>{slotToTime(s)}</option>
            ))}
          </select>
        </div>

        <div className="flex gap-2 pt-1">
          <button
            onClick={handleSave}
            disabled={!title.trim()}
            className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Salvar
          </button>
          {initial?.id && (
            <button onClick={() => onDelete(initial.id)} className="px-3 rounded-lg bg-red-50 text-red-600 text-sm hover:bg-red-100">
              Excluir
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Type legend (editable) ────────────────────────────────────────────────────

function TypeLegend({ taskTypes, onUpdate, onAdd, onRemove }) {
  const [editId,    setEditId]    = useState(null)
  const [editLabel, setEditLabel] = useState('')
  const [editColor, setEditColor] = useState('')
  const [showAdd,   setShowAdd]   = useState(false)
  const [newLabel,  setNewLabel]  = useState('')
  const [newColor,  setNewColor]  = useState(COLOR_OPTIONS[0])

  function startEdit(t) { setEditId(t.id); setEditLabel(t.label); setEditColor(t.bg) }

  function commitEdit() {
    if (editLabel.trim()) onUpdate(editId, { label: editLabel.trim(), bg: editColor })
    setEditId(null)
  }

  function commitAdd() {
    if (newLabel.trim()) { onAdd(newLabel.trim(), newColor); setNewLabel(''); setNewColor(COLOR_OPTIONS[0]); setShowAdd(false) }
  }

  return (
    <div className="px-4 py-3 border-t border-gray-100 bg-gray-50">
      <div className="flex flex-wrap gap-x-4 gap-y-2 items-center">
        {taskTypes.map(t => (
          <div key={t.id} className="flex items-center gap-1 group">
            {editId === t.id ? (
              <>
                <div className="flex gap-1 mr-1">
                  {COLOR_OPTIONS.map(c => (
                    <button
                      key={c}
                      onClick={() => setEditColor(c)}
                      className={`w-3.5 h-3.5 rounded-sm ${c} ${editColor === c ? 'ring-2 ring-offset-1 ring-gray-500' : ''}`}
                    />
                  ))}
                </div>
                <input
                  autoFocus
                  value={editLabel}
                  onChange={e => setEditLabel(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditId(null) }}
                  className="border border-gray-300 rounded px-1.5 py-0.5 text-xs w-24 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button onClick={commitEdit} className="text-emerald-600 hover:text-emerald-700 ml-1"><Check className="w-3.5 h-3.5" /></button>
                <button onClick={() => setEditId(null)} className="text-gray-400 hover:text-gray-600"><X className="w-3.5 h-3.5" /></button>
              </>
            ) : (
              <>
                <span className={`inline-block w-2.5 h-2.5 rounded-sm ${t.bg}`} />
                <span className="text-xs text-gray-600">{t.label}</span>
                <button
                  onClick={() => startEdit(t)}
                  className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-600 transition-opacity ml-0.5"
                >
                  <Pencil className="w-3 h-3" />
                </button>
                {taskTypes.length > 1 && (
                  <button
                    onClick={() => onRemove(t.id)}
                    className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </>
            )}
          </div>
        ))}

        {showAdd ? (
          <div className="flex items-center gap-1.5">
            <div className="flex gap-1 mr-1">
              {COLOR_OPTIONS.map(c => (
                <button
                  key={c}
                  onClick={() => setNewColor(c)}
                  className={`w-3.5 h-3.5 rounded-sm ${c} ${newColor === c ? 'ring-2 ring-offset-1 ring-gray-500' : ''}`}
                />
              ))}
            </div>
            <input
              autoFocus
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') commitAdd(); if (e.key === 'Escape') setShowAdd(false) }}
              placeholder="Nome..."
              className="border border-gray-300 rounded px-1.5 py-0.5 text-xs w-24 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button onClick={commitAdd} className="text-emerald-600 hover:text-emerald-700"><Check className="w-3.5 h-3.5" /></button>
            <button onClick={() => setShowAdd(false)} className="text-gray-400 hover:text-gray-600"><X className="w-3.5 h-3.5" /></button>
          </div>
        ) : (
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-blue-600 transition-colors"
          >
            <Plus className="w-3 h-3" />
            Adicionar etiqueta
          </button>
        )}

        <span className="ml-auto text-xs text-gray-400 hidden sm:block">Clique numa célula · Arraste para mover/redimensionar</span>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Tarefas() {
  const { tasks, addTask, updateTask, removeTask, summaries, updateSummary, taskTypes, updateTaskType, addTaskType, removeTaskType } = useTaskData()
  const [weekOffset,   setWeekOffset]   = useState(0)
  const [modal,        setModal]        = useState(null)
  const [draftSummary, setDraftSummary] = useState({})
  const [dragPreview,  setDragPreviewState] = useState(null)

  const dragPreviewRef = useRef(null)
  const gridBodyRef    = useRef(null)

  const today     = useMemo(() => new Date(), [])
  const weekStart = useMemo(() => startOfISOWeek(addWeeks(today, weekOffset)), [today, weekOffset])
  const weekKey   = useMemo(() => getWeekKey(weekStart), [weekStart])
  const weekDays  = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])

  useEffect(() => { setDraftSummary(summaries[weekKey] || {}) }, [weekKey, summaries])

  // cleanup body cursor/select on unmount
  useEffect(() => () => { document.body.style.cursor = ''; document.body.style.userSelect = '' }, [])

  const typeMap   = useMemo(() => Object.fromEntries(taskTypes.map(t => [t.id, t])), [taskTypes])
  const weekTasks = useMemo(() => tasks.filter(t => t.weekKey === weekKey), [tasks, weekKey])

  // Merge drag preview for live rendering
  const effectiveTasks = useMemo(() => {
    if (!dragPreview) return weekTasks
    return weekTasks.map(t => t.id === dragPreview.id ? { ...t, ...dragPreview } : t)
  }, [weekTasks, dragPreview])

  const tasksByDay = useMemo(() => {
    const byDay = Array.from({ length: 7 }, () => [])
    effectiveTasks.forEach(t => { if (t.dayIdx >= 0 && t.dayIdx < 7) byDay[t.dayIdx].push(t) })
    return byDay
  }, [effectiveTasks])

  const todayStr = format(today, 'yyyy-MM-dd')

  function setDragPreview(v) { dragPreviewRef.current = v; setDragPreviewState(v) }

  // ── Move drag ───────────────────────────────────────────────────────────────
  const startMove = useCallback((e, task) => {
    e.preventDefault()
    e.stopPropagation()

    const origX = e.clientX, origY = e.clientY
    const duration = task.endSlot - task.startSlot
    let isDragging = false

    function handleMove(e) {
      if (!isDragging) {
        if (Math.hypot(e.clientX - origX, e.clientY - origY) < 5) return
        isDragging = true
        document.body.style.cursor = 'grabbing'
      }
      const slotDelta = Math.round((e.clientY - origY) / SLOT_HEIGHT)
      const newStart  = clamp(0, TOTAL_SLOTS - duration, task.startSlot + slotDelta)
      let   newDay    = task.dayIdx
      if (gridBodyRef.current) {
        const rect = gridBodyRef.current.getBoundingClientRect()
        newDay = clamp(0, 6, Math.floor((e.clientX - rect.left) / (rect.width / 7)))
      }
      setDragPreview({ id: task.id, dayIdx: newDay, startSlot: newStart, endSlot: newStart + duration })
    }

    function handleUp() {
      document.removeEventListener('mousemove', handleMove)
      document.removeEventListener('mouseup', handleUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      if (isDragging) {
        const p = dragPreviewRef.current
        if (p) updateTask(task.id, { dayIdx: p.dayIdx, startSlot: p.startSlot, endSlot: p.endSlot })
        setDragPreview(null)
      } else {
        setModal({ dayIdx: task.dayIdx, startSlot: task.startSlot, task })
      }
    }

    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', handleMove)
    document.addEventListener('mouseup', handleUp)
  }, [updateTask])

  // ── Resize drag ─────────────────────────────────────────────────────────────
  const startResize = useCallback((e, task) => {
    e.preventDefault()
    e.stopPropagation()

    const origY = e.clientY
    setDragPreview({ id: task.id, dayIdx: task.dayIdx, startSlot: task.startSlot, endSlot: task.endSlot })

    function handleMove(e) {
      const slotDelta  = Math.round((e.clientY - origY) / SLOT_HEIGHT)
      const newEndSlot = clamp(task.startSlot + 1, TOTAL_SLOTS, task.endSlot + slotDelta)
      setDragPreview({ id: task.id, dayIdx: task.dayIdx, startSlot: task.startSlot, endSlot: newEndSlot })
    }

    function handleUp() {
      document.removeEventListener('mousemove', handleMove)
      document.removeEventListener('mouseup', handleUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      const p = dragPreviewRef.current
      if (p && p.endSlot !== task.endSlot) updateTask(task.id, { endSlot: p.endSlot })
      setDragPreview(null)
    }

    document.body.style.cursor = 'ns-resize'
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', handleMove)
    document.addEventListener('mouseup', handleUp)
  }, [updateTask])

  function handleSaveTask({ title, type, endSlot }) {
    if (!modal) return
    if (modal.task) {
      updateTask(modal.task.id, { title, type, endSlot })
    } else {
      addTask({ weekKey, dayIdx: modal.dayIdx, startSlot: modal.startSlot, endSlot, title, type })
    }
    setModal(null)
  }

  function handleDeleteTask(id) { removeTask(id); setModal(null) }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-blue-600" />
            Tarefas
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Grade semanal e resumo de atividades</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setWeekOffset(0)} className="text-xs text-blue-600 hover:underline font-medium">
            Semana atual
          </button>
          <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg px-2 py-1 shadow-sm">
            <button onClick={() => setWeekOffset(o => o - 1)} className="p-1 rounded hover:bg-gray-100 text-gray-500">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-medium text-gray-700 px-2 min-w-[148px] text-center">
              {format(weekDays[0], 'dd/MM')} – {format(weekDays[6], 'dd/MM/yyyy')}
            </span>
            <button onClick={() => setWeekOffset(o => o + 1)} className="p-1 rounded hover:bg-gray-100 text-gray-500">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Weekly Grid */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-auto max-h-[560px]">
          <div className="flex min-w-[640px]">

            {/* Time label column */}
            <div className="w-16 shrink-0 flex flex-col">
              <div className="h-10 sticky top-0 bg-gray-50 z-20 border-b border-r border-gray-200 shrink-0" />
              {Array.from({ length: TOTAL_SLOTS }, (_, i) => (
                <div
                  key={i}
                  style={{ height: SLOT_HEIGHT }}
                  className="flex items-center justify-end pr-2 border-b border-r border-gray-100 shrink-0"
                >
                  <span className="text-[10px] text-gray-400 leading-none select-none tabular-nums">
                    {slotToTime(i)}
                  </span>
                </div>
              ))}
            </div>

            {/* Day columns */}
            <div ref={gridBodyRef} className="flex flex-1">
              {weekDays.map((day, dayIdx) => {
                const dateStr  = format(day, 'yyyy-MM-dd')
                const isToday  = dateStr === todayStr
                const dayTasks = tasksByDay[dayIdx]

                return (
                  <div key={dayIdx} className="flex-1 flex flex-col min-w-0">
                    {/* Day header */}
                    <div className={`h-10 sticky top-0 z-20 flex flex-col items-center justify-center border-b border-l border-gray-200 shrink-0 ${isToday ? 'bg-blue-50' : 'bg-gray-50'}`}>
                      <span className={`text-xs font-semibold leading-tight ${isToday ? 'text-blue-700' : 'text-gray-600'}`}>{DAYS_PT[dayIdx]}</span>
                      <span className={`text-[10px] leading-tight ${isToday ? 'text-blue-500' : 'text-gray-400'}`}>{format(day, 'dd/MM')}</span>
                    </div>

                    {/* Grid body */}
                    <div className="relative border-l border-gray-200">
                      {/* Clickable cells */}
                      {Array.from({ length: TOTAL_SLOTS }, (_, slotIdx) => (
                        <div
                          key={slotIdx}
                          style={{ height: SLOT_HEIGHT }}
                          onClick={() => { if (!dragPreviewRef.current) setModal({ dayIdx, startSlot: slotIdx, task: null }) }}
                          className={`border-b border-gray-100 cursor-pointer transition-colors ${isToday ? 'hover:bg-blue-50/60' : 'hover:bg-gray-50'}`}
                        />
                      ))}

                      {/* Task blocks */}
                      {dayTasks.map(task => {
                        const t      = typeMap[task.type] || taskTypes[0]
                        if (!t) return null
                        const blockH    = (task.endSlot - task.startSlot) * SLOT_HEIGHT
                        const isPreview = dragPreview?.id === task.id
                        return (
                          <div
                            key={task.id}
                            style={{ position: 'absolute', top: task.startSlot * SLOT_HEIGHT + 1, height: blockH - 2, left: 3, right: 3 }}
                            className={`${t.bg} text-white rounded-md text-xs overflow-hidden z-10 shadow-sm select-none pb-3 ${
                              isPreview ? 'opacity-90 ring-2 ring-white/50 cursor-grabbing' : 'cursor-grab'
                            }`}
                            onMouseDown={e => startMove(e, task)}
                            onClick={e => e.stopPropagation()}
                          >
                            <div className="px-1.5 pt-0.5 font-medium leading-tight truncate">{task.title}</div>
                            {blockH >= 58 && (
                              <div className="px-1.5 text-white/75 text-[10px] leading-tight">
                                {slotToTime(task.startSlot)}–{slotToTime(task.endSlot)}
                              </div>
                            )}
                            {/* Resize handle */}
                            <div
                              className="absolute bottom-0 left-0 right-0 h-3 cursor-ns-resize flex items-center justify-center"
                              onMouseDown={e => startResize(e, task)}
                              onClick={e => e.stopPropagation()}
                            >
                              <div className="w-8 h-0.5 bg-white/40 rounded-full" />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <TypeLegend
          taskTypes={taskTypes}
          onUpdate={updateTaskType}
          onAdd={addTaskType}
          onRemove={removeTaskType}
        />
      </div>

      {/* Weekly Summary */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="mb-4">
          <h2 className="font-semibold text-gray-800">Resumo da Semana</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Semana {getISOWeek(weekStart)} · {format(weekDays[0], 'dd/MM')} – {format(weekDays[6], 'dd/MM/yyyy')}
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {SUMMARY_CATS.map(cat => {
            const value  = draftSummary[cat.id] || ''
            const filled = value.trim().length > 0
            return (
              <div key={cat.id} className="border border-gray-200 rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-base leading-none">{cat.emoji}</span>
                  <span className="text-sm font-medium text-gray-700">{cat.label}</span>
                  {filled
                    ? <CheckCircle2 className="w-4 h-4 text-emerald-500 ml-auto shrink-0" />
                    : <Circle       className="w-4 h-4 text-gray-300 ml-auto shrink-0" />
                  }
                </div>
                <textarea
                  value={value}
                  onChange={e => setDraftSummary(prev => ({ ...prev, [cat.id]: e.target.value }))}
                  onBlur={e => updateSummary(weekKey, { [cat.id]: e.target.value })}
                  placeholder="O que fez nessa categoria esta semana?"
                  rows={3}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700 placeholder-gray-400"
                />
              </div>
            )
          })}
        </div>
      </div>

      {/* Task modal */}
      {modal && (
        <TaskModal
          initial={
            modal.task
              ? { ...modal.task }
              : { startSlot: modal.startSlot, endSlot: Math.min(modal.startSlot + 2, TOTAL_SLOTS) }
          }
          taskTypes={taskTypes}
          onSave={handleSaveTask}
          onDelete={handleDeleteTask}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
