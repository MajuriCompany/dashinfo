import { useState, useMemo, useRef, useCallback, useEffect } from 'react'
import { ChevronLeft, ChevronRight, X, ClipboardList, Plus, Pencil, Trash2, Check, Settings2 } from 'lucide-react'
import { getISOWeek, getISOWeekYear, startOfISOWeek, addWeeks, addDays, format } from 'date-fns'
import { useTaskData } from '../hooks/useTaskData'

// ── Constants ─────────────────────────────────────────────────────────────────

const SLOT_HEIGHT = 36
const START_HOUR  = 6
const END_HOUR    = 23
const TOTAL_SLOTS = (END_HOUR - START_HOUR) * 2

const DAYS_PT   = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
const MONTHS_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

const GRID_COLORS = [
  'bg-blue-500','bg-emerald-500','bg-amber-500','bg-purple-500',
  'bg-red-500', 'bg-pink-500',   'bg-cyan-500', 'bg-indigo-500',
  'bg-teal-500','bg-orange-500',
]

// Tag colors for summary pills (soft palette)
const PILL_COLORS = [
  { bg: 'bg-blue-100',   text: 'text-blue-700',   ring: 'ring-blue-300' },
  { bg: 'bg-emerald-100',text: 'text-emerald-700', ring: 'ring-emerald-300' },
  { bg: 'bg-amber-100',  text: 'text-amber-700',   ring: 'ring-amber-300' },
  { bg: 'bg-purple-100', text: 'text-purple-700',  ring: 'ring-purple-300' },
  { bg: 'bg-red-100',    text: 'text-red-700',     ring: 'ring-red-300' },
  { bg: 'bg-pink-100',   text: 'text-pink-700',    ring: 'ring-pink-300' },
  { bg: 'bg-cyan-100',   text: 'text-cyan-700',    ring: 'ring-cyan-300' },
  { bg: 'bg-indigo-100', text: 'text-indigo-700',  ring: 'ring-indigo-300' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function clamp(min, max, val) { return Math.min(max, Math.max(min, val)) }

function getWeekKey(date) {
  return `${getISOWeekYear(date)}-W${String(getISOWeek(date)).padStart(2, '0')}`
}

function slotToTime(slot) {
  const mins = START_HOUR * 60 + slot * 30
  const h = Math.floor(mins / 60), m = mins % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function weeksForMonth(year, month0) {
  const firstDay = new Date(year, month0, 1)
  const lastDay  = new Date(year, month0 + 1, 0)
  const start    = startOfISOWeek(firstDay)
  const end      = startOfISOWeek(lastDay)
  const weeks    = []
  let   curr     = start
  while (curr <= end) { weeks.push(new Date(curr)); curr = addWeeks(curr, 1) }
  return weeks
}

function pillStyle(idx) {
  const c = PILL_COLORS[idx % PILL_COLORS.length]
  return `${c.bg} ${c.text}`
}

// ── Task modal ────────────────────────────────────────────────────────────────

function TaskModal({ initial, taskTypes, onSave, onDelete, onClose }) {
  const startSlot = initial?.startSlot ?? 0
  const [title,   setTitle]   = useState(initial?.title ?? '')
  const [typeId,  setTypeId]  = useState(initial?.type  ?? (taskTypes[0]?.id ?? ''))
  const [endSlot, setEndSlot] = useState(initial?.endSlot ?? Math.min(startSlot + 2, TOTAL_SLOTS))
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
            autoFocus value={title} onChange={e => setTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
            placeholder="Ex: Call com cliente..."
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Tipo</label>
          <div className="flex gap-2 flex-wrap">
            {taskTypes.map(t => (
              <button key={t.id} onClick={() => setTypeId(t.id)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${typeId === t.id ? `${t.bg} text-white` : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Início: {slotToTime(startSlot)} — Término:</label>
          <select value={endSlot} onChange={e => setEndSlot(Number(e.target.value))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            {Array.from({ length: TOTAL_SLOTS - minEnd + 1 }, (_, i) => minEnd + i).map(s => (
              <option key={s} value={s}>{slotToTime(s)}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-2 pt-1">
          <button onClick={handleSave} disabled={!title.trim()}
            className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed">
            Salvar
          </button>
          {initial?.id && (
            <button onClick={() => onDelete(initial.id)} className="px-3 rounded-lg bg-red-50 text-red-600 text-sm hover:bg-red-100">Excluir</button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Grid task-type legend (editable) ─────────────────────────────────────────

function TypeLegend({ taskTypes, onUpdate, onAdd, onRemove }) {
  const [editId, setEditId] = useState(null)
  const [editLabel, setEditLabel] = useState('')
  const [editColor, setEditColor] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [newColor, setNewColor] = useState(GRID_COLORS[0])

  function startEdit(t) { setEditId(t.id); setEditLabel(t.label); setEditColor(t.bg) }
  function commitEdit() { if (editLabel.trim()) onUpdate(editId, { label: editLabel.trim(), bg: editColor }); setEditId(null) }
  function commitAdd()  { if (newLabel.trim()) { onAdd(newLabel.trim(), newColor); setNewLabel(''); setNewColor(GRID_COLORS[0]); setShowAdd(false) } }

  return (
    <div className="px-4 py-3 border-t border-gray-100 bg-gray-50">
      <div className="flex flex-wrap gap-x-4 gap-y-2 items-center">
        {taskTypes.map(t => (
          <div key={t.id} className="flex items-center gap-1 group">
            {editId === t.id ? (
              <>
                <div className="flex gap-1 mr-1">
                  {GRID_COLORS.map(c => (
                    <button key={c} onClick={() => setEditColor(c)}
                      className={`w-3.5 h-3.5 rounded-sm ${c} ${editColor === c ? 'ring-2 ring-offset-1 ring-gray-500' : ''}`} />
                  ))}
                </div>
                <input autoFocus value={editLabel} onChange={e => setEditLabel(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditId(null) }}
                  className="border border-gray-300 rounded px-1.5 py-0.5 text-xs w-24 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                <button onClick={commitEdit} className="text-emerald-600 hover:text-emerald-700 ml-1"><Check className="w-3.5 h-3.5" /></button>
                <button onClick={() => setEditId(null)} className="text-gray-400 hover:text-gray-600"><X className="w-3.5 h-3.5" /></button>
              </>
            ) : (
              <>
                <span className={`inline-block w-2.5 h-2.5 rounded-sm ${t.bg}`} />
                <span className="text-xs text-gray-600">{t.label}</span>
                <button onClick={() => startEdit(t)} className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-600 transition-opacity ml-0.5"><Pencil className="w-3 h-3" /></button>
                {taskTypes.length > 1 && (
                  <button onClick={() => onRemove(t.id)} className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity"><Trash2 className="w-3 h-3" /></button>
                )}
              </>
            )}
          </div>
        ))}
        {showAdd ? (
          <div className="flex items-center gap-1.5">
            <div className="flex gap-1 mr-1">
              {GRID_COLORS.map(c => (
                <button key={c} onClick={() => setNewColor(c)}
                  className={`w-3.5 h-3.5 rounded-sm ${c} ${newColor === c ? 'ring-2 ring-offset-1 ring-gray-500' : ''}`} />
              ))}
            </div>
            <input autoFocus value={newLabel} onChange={e => setNewLabel(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') commitAdd(); if (e.key === 'Escape') setShowAdd(false) }}
              placeholder="Nome..."
              className="border border-gray-300 rounded px-1.5 py-0.5 text-xs w-24 focus:outline-none focus:ring-1 focus:ring-blue-500" />
            <button onClick={commitAdd} className="text-emerald-600 hover:text-emerald-700"><Check className="w-3.5 h-3.5" /></button>
            <button onClick={() => setShowAdd(false)} className="text-gray-400 hover:text-gray-600"><X className="w-3.5 h-3.5" /></button>
          </div>
        ) : (
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-1 text-xs text-gray-400 hover:text-blue-600 transition-colors">
            <Plus className="w-3 h-3" />Adicionar etiqueta
          </button>
        )}
        <span className="ml-auto text-xs text-gray-400 hidden sm:block">Clique numa célula · Arraste para mover/redimensionar</span>
      </div>
    </div>
  )
}

// ── Monthly summary ───────────────────────────────────────────────────────────

function ObsCell({ obs, onSave }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState('')

  function open() { setVal(obs); setEditing(true) }
  function save() { onSave(val); setEditing(false) }

  if (editing) return (
    <textarea
      autoFocus
      value={val}
      onChange={e => setVal(e.target.value)}
      onBlur={save}
      onKeyDown={e => {
        if (e.key === 'Escape') setEditing(false)
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); save() }
      }}
      rows={2}
      placeholder="Observação da semana…"
      className="w-44 shrink-0 text-xs text-gray-600 border border-blue-300 rounded-lg px-2 py-1 focus:outline-none resize-none leading-relaxed"
    />
  )

  return (
    <button
      onClick={open}
      className={`w-44 shrink-0 text-xs text-left px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors ${obs ? 'text-gray-500' : 'text-gray-300'}`}
    >
      {obs
        ? <span className="line-clamp-2 leading-snug">{obs}</span>
        : <span className="flex items-center gap-1"><Pencil className="w-3 h-3" /><span>Observação</span></span>
      }
    </button>
  )
}

function TagDropdown({ weekKey, available, summaryLabels, onAdd, onAddNote, onClose }) {
  const ref     = useRef(null)
  const inputRef = useRef(null)
  const [noteText, setNoteText] = useState('')

  useEffect(() => {
    inputRef.current?.focus({ preventScroll: true })
  }, [])

  useEffect(() => {
    function handle(e) { if (ref.current && !ref.current.contains(e.target)) onClose() }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [onClose])

  function submitNote() {
    if (noteText.trim()) { onAddNote(weekKey, noteText.trim()); onClose() }
  }

  return (
    <div ref={ref} className="absolute z-30 top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg min-w-[230px]">
      <div className="px-3 pt-2.5 pb-2">
        <div className="flex items-center gap-1.5">
          <input
            ref={inputRef}
            placeholder="Nota rápida desta semana…"
            value={noteText}
            onChange={e => setNoteText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submitNote(); if (e.key === 'Escape') onClose() }}
            className="flex-1 text-xs border border-gray-200 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400 placeholder-gray-300"
          />
          <button
            onMouseDown={e => e.preventDefault()}
            onClick={submitNote}
            disabled={!noteText.trim()}
            className="text-emerald-500 hover:text-emerald-600 disabled:opacity-30 transition-opacity"
          >
            <Check className="w-3.5 h-3.5" />
          </button>
        </div>
        <p className="text-[10px] text-gray-400 mt-1">Só nesta semana · Enter para adicionar</p>
      </div>
      {available.length > 0 && (
        <>
          <div className="border-t border-gray-100" />
          <p className="px-3 pt-1.5 pb-0.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Etiquetas permanentes</p>
          {available.map(lbl => {
            const colorIdx = summaryLabels.indexOf(lbl)
            return (
              <button key={lbl.id} onClick={() => { onAdd(weekKey, lbl.id); onClose() }}
                className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${pillStyle(colorIdx)}`}>{lbl.emoji} {lbl.label}</span>
              </button>
            )
          })}
          <div className="pb-1" />
        </>
      )}
    </div>
  )
}

function SummaryLabelEditor({ labels, onUpdate, onAdd, onRemove }) {
  const [editId,    setEditId]    = useState(null)
  const [editEmoji, setEditEmoji] = useState('')
  const [editLabel, setEditLabel] = useState('')
  const [showAdd,   setShowAdd]   = useState(false)
  const [newEmoji,  setNewEmoji]  = useState('')
  const [newLabel,  setNewLabel]  = useState('')

  function startEdit(l) { setEditId(l.id); setEditEmoji(l.emoji); setEditLabel(l.label) }
  function commitEdit() { if (editLabel.trim()) onUpdate(editId, { emoji: editEmoji.trim() || '🏷️', label: editLabel.trim() }); setEditId(null) }
  function commitAdd()  { if (newLabel.trim()) { onAdd(newEmoji.trim() || '🏷️', newLabel.trim()); setNewEmoji(''); setNewLabel(''); setShowAdd(false) } }

  return (
    <div className="mt-3 pt-3 border-t border-gray-100">
      <p className="text-xs text-gray-400 font-medium mb-2">Gerenciar etiquetas</p>
      <div className="flex flex-wrap gap-2 items-center">
        {labels.map((lbl, i) => (
          <div key={lbl.id} className="flex items-center gap-1 group">
            {editId === lbl.id ? (
              <>
                <input value={editEmoji} onChange={e => setEditEmoji(e.target.value)} placeholder="emoji"
                  className="border border-gray-300 rounded px-1.5 py-0.5 text-xs w-12 text-center focus:outline-none focus:ring-1 focus:ring-blue-500" />
                <input autoFocus value={editLabel} onChange={e => setEditLabel(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditId(null) }}
                  className="border border-gray-300 rounded px-1.5 py-0.5 text-xs w-28 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                <button onClick={commitEdit} className="text-emerald-600 hover:text-emerald-700"><Check className="w-3.5 h-3.5" /></button>
                <button onClick={() => setEditId(null)} className="text-gray-400 hover:text-gray-600"><X className="w-3.5 h-3.5" /></button>
              </>
            ) : (
              <>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${pillStyle(i)}`}>
                  {lbl.emoji} {lbl.label}
                </span>
                <button onClick={() => startEdit(lbl)} className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-600 transition-opacity"><Pencil className="w-3 h-3" /></button>
                {labels.length > 1 && (
                  <button onClick={() => onRemove(lbl.id)} className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity"><Trash2 className="w-3 h-3" /></button>
                )}
              </>
            )}
          </div>
        ))}
        {showAdd ? (
          <div className="flex items-center gap-1.5">
            <input value={newEmoji} onChange={e => setNewEmoji(e.target.value)} placeholder="emoji"
              className="border border-gray-300 rounded px-1.5 py-0.5 text-xs w-12 text-center focus:outline-none focus:ring-1 focus:ring-blue-500" />
            <input autoFocus value={newLabel} onChange={e => setNewLabel(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') commitAdd(); if (e.key === 'Escape') setShowAdd(false) }}
              placeholder="Nome da etiqueta"
              className="border border-gray-300 rounded px-1.5 py-0.5 text-xs w-32 focus:outline-none focus:ring-1 focus:ring-blue-500" />
            <button onClick={commitAdd} className="text-emerald-600 hover:text-emerald-700"><Check className="w-3.5 h-3.5" /></button>
            <button onClick={() => setShowAdd(false)} className="text-gray-400 hover:text-gray-600"><X className="w-3.5 h-3.5" /></button>
          </div>
        ) : (
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-1 text-xs text-gray-400 hover:text-blue-600 transition-colors">
            <Plus className="w-3 h-3" />Nova etiqueta
          </button>
        )}
      </div>
    </div>
  )
}

function MonthlySummary({ summaries, updateSummary, summaryLabels, updateSummaryLabel, addSummaryLabel, removeSummaryLabel, currentWeekKey, todayStr }) {
  const today = useMemo(() => new Date(), [])
  const [monthOffset,  setMonthOffset]  = useState(0)
  const [openDropdown, setOpenDropdown] = useState(null)
  const [showEditor,   setShowEditor]   = useState(false)

  const currentMonth = useMemo(() => new Date(today.getFullYear(), today.getMonth() + monthOffset, 1), [today, monthOffset])
  const weeks        = useMemo(() => weeksForMonth(currentMonth.getFullYear(), currentMonth.getMonth()), [currentMonth])
  const monthLabel   = `${MONTHS_PT[currentMonth.getMonth()]} ${currentMonth.getFullYear()}`

  function toggleTag(weekKey, tagId) {
    const curr = summaries[weekKey]?.tags
    const tags = Array.isArray(curr) ? curr : []
    const next = tags.includes(tagId) ? tags.filter(t => t !== tagId) : [...tags, tagId]
    updateSummary(weekKey, { tags: next })
  }

  function saveObs(weekKey, obs) { updateSummary(weekKey, { obs }) }

  function addNote(weekKey, text) {
    const curr = Array.isArray(summaries[weekKey]?.notes) ? summaries[weekKey].notes : []
    updateSummary(weekKey, { notes: [...curr, text] })
  }

  function removeNote(weekKey, idx) {
    const curr = Array.isArray(summaries[weekKey]?.notes) ? summaries[weekKey].notes : []
    updateSummary(weekKey, { notes: curr.filter((_, i) => i !== idx) })
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <div>
          <h2 className="font-semibold text-gray-800">Resumo Mensal</h2>
          <p className="text-xs text-gray-400 mt-0.5">Etiquetas e notas por semana</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowEditor(s => !s)}
            title="Gerenciar etiquetas"
            className={`p-1.5 rounded-lg transition-colors ${showEditor ? 'bg-blue-50 text-blue-600' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'}`}
          >
            <Settings2 className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-0.5 bg-gray-50 border border-gray-200 rounded-lg px-1 py-1">
            <button onClick={() => setMonthOffset(o => o - 1)} className="p-1 rounded-md hover:bg-white hover:shadow-sm text-gray-400 transition-all"><ChevronLeft className="w-3.5 h-3.5" /></button>
            <span className="text-sm font-medium text-gray-700 px-3 min-w-[128px] text-center">{monthLabel}</span>
            <button onClick={() => setMonthOffset(o => o + 1)} className="p-1 rounded-md hover:bg-white hover:shadow-sm text-gray-400 transition-all"><ChevronRight className="w-3.5 h-3.5" /></button>
          </div>
        </div>
      </div>

      {/* Week rows */}
      <div className="divide-y divide-gray-50">
        {weeks.map(weekStart => {
          const wKey      = getWeekKey(weekStart)
          const days      = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
          const isNow     = wKey === currentWeekKey
          const summary   = summaries[wKey] || {}
          const tags      = Array.isArray(summary.tags) ? summary.tags : []
          const notes     = Array.isArray(summary.notes) ? summary.notes : []
          const obs       = typeof summary.obs === 'string' ? summary.obs : ''
          const available = summaryLabels.filter(l => !tags.includes(l.id))

          return (
            <div
              key={wKey}
              className={`flex items-center gap-4 pl-5 pr-6 py-3 border-l-[3px] transition-colors ${
                isNow
                  ? 'border-l-blue-500 bg-blue-50/30'
                  : 'border-l-transparent hover:bg-gray-50/60'
              }`}
            >
              {/* Date range label */}
              <div className="w-[84px] shrink-0">
                <span className={`text-[11px] font-semibold tabular-nums ${isNow ? 'text-blue-600' : 'text-gray-400'}`}>
                  {format(days[0], 'dd/MM')} – {format(days[6], 'dd/MM')}
                </span>
              </div>

              {/* Day cells (mini calendar strip) */}
              <div className="flex gap-0.5 shrink-0">
                {days.map(day => {
                  const dStr    = format(day, 'yyyy-MM-dd')
                  const inMonth = day.getMonth() === currentMonth.getMonth()
                  const isToday = dStr === todayStr
                  return (
                    <div key={dStr} className="w-[26px] h-[26px] flex items-center justify-center">
                      <span className={`w-[22px] h-[22px] flex items-center justify-center rounded-full text-[11px] leading-none tabular-nums transition-colors ${
                        isToday  ? 'bg-blue-600 text-white font-bold'
                        : inMonth ? 'text-gray-600 font-medium'
                        :           'text-gray-300'
                      }`}>
                        {format(day, 'd')}
                      </span>
                    </div>
                  )
                })}
              </div>

              {/* Tags */}
              <div className="flex-1 min-w-0 flex flex-wrap gap-1.5 items-center">
                {tags.map(tagId => {
                  const lbl = summaryLabels.find(l => l.id === tagId)
                  if (!lbl) return null
                  const i = summaryLabels.indexOf(lbl)
                  return (
                    <span key={tagId} className={`inline-flex items-center gap-1 pl-2 pr-1 py-[3px] rounded-full text-[11px] font-medium ${pillStyle(i)}`}>
                      <span className="leading-none">{lbl.emoji}</span>
                      <span>{lbl.label}</span>
                      <button onClick={() => toggleTag(wKey, tagId)} className="rounded-full hover:bg-black/10 p-[2px] leading-none ml-0.5">
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </span>
                  )
                })}

                {notes.map((note, i) => (
                  <span key={i} className="inline-flex items-center gap-1 pl-2 pr-1 py-[3px] rounded-full text-[11px] font-medium border border-dashed border-gray-300 text-gray-500 bg-white italic">
                    <span className="leading-none">{note}</span>
                    <button onClick={() => removeNote(wKey, i)} className="rounded-full hover:bg-gray-200 p-[2px] leading-none ml-0.5 not-italic">
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                ))}
                <div className="relative">
                  <button
                    onClick={() => setOpenDropdown(openDropdown === wKey ? null : wKey)}
                    className="w-6 h-6 flex items-center justify-center rounded-full border border-dashed border-gray-300 text-gray-400 hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50 transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                  {openDropdown === wKey && (
                    <TagDropdown
                      weekKey={wKey}
                      available={available}
                      summaryLabels={summaryLabels}
                      onAdd={(wk, id) => toggleTag(wk, id)}
                      onAddNote={(wk, text) => addNote(wk, text)}
                      onClose={() => setOpenDropdown(null)}
                    />
                  )}
                </div>
              </div>

              {/* Obs cell */}
              <ObsCell key={`${wKey}-obs`} obs={obs} onSave={val => saveObs(wKey, val)} />
            </div>
          )
        })}
      </div>

      {/* Label editor */}
      {showEditor && (
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/60">
          <SummaryLabelEditor
            labels={summaryLabels}
            onUpdate={updateSummaryLabel}
            onAdd={addSummaryLabel}
            onRemove={removeSummaryLabel}
          />
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Tarefas() {
  const {
    tasks, addTask, updateTask, removeTask,
    summaries, updateSummary,
    taskTypes, updateTaskType, addTaskType, removeTaskType,
    summaryLabels, updateSummaryLabel, addSummaryLabel, removeSummaryLabel,
  } = useTaskData()

  const [weekOffset,        setWeekOffset]        = useState(0)
  const [modal,             setModal]             = useState(null)
  const [dragPreview,       setDragPreviewState]  = useState(null)

  const dragPreviewRef = useRef(null)
  const gridBodyRef    = useRef(null)

  const today      = useMemo(() => new Date(), [])
  const weekStart  = useMemo(() => startOfISOWeek(addWeeks(today, weekOffset)), [today, weekOffset])
  const weekKey    = useMemo(() => getWeekKey(weekStart), [weekStart])
  const weekDays   = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])
  const todayStr   = format(today, 'yyyy-MM-dd')
  const currentWeekKey = useMemo(() => getWeekKey(today), [today])

  const typeMap    = useMemo(() => Object.fromEntries(taskTypes.map(t => [t.id, t])), [taskTypes])
  const weekTasks  = useMemo(() => tasks.filter(t => t.weekKey === weekKey), [tasks, weekKey])

  const effectiveTasks = useMemo(() => {
    if (!dragPreview) return weekTasks
    return weekTasks.map(t => t.id === dragPreview.id ? { ...t, ...dragPreview } : t)
  }, [weekTasks, dragPreview])

  const tasksByDay = useMemo(() => {
    const byDay = Array.from({ length: 7 }, () => [])
    effectiveTasks.forEach(t => { if (t.dayIdx >= 0 && t.dayIdx < 7) byDay[t.dayIdx].push(t) })
    return byDay
  }, [effectiveTasks])

  useEffect(() => () => { document.body.style.cursor = ''; document.body.style.userSelect = '' }, [])

  function setDragPreview(v) { dragPreviewRef.current = v; setDragPreviewState(v) }

  const startMove = useCallback((e, task) => {
    e.preventDefault(); e.stopPropagation()
    const origX = e.clientX, origY = e.clientY
    const duration = task.endSlot - task.startSlot
    let isDragging = false

    function handleMove(e) {
      if (!isDragging) {
        if (Math.hypot(e.clientX - origX, e.clientY - origY) < 5) return
        isDragging = true; document.body.style.cursor = 'grabbing'
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
      document.body.style.cursor = ''; document.body.style.userSelect = ''
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

  const startResize = useCallback((e, task) => {
    e.preventDefault(); e.stopPropagation()
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
      document.body.style.cursor = ''; document.body.style.userSelect = ''
      const p = dragPreviewRef.current
      if (p && p.endSlot !== task.endSlot) updateTask(task.id, { endSlot: p.endSlot })
      setDragPreview(null)
    }

    document.body.style.cursor = 'ns-resize'; document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', handleMove)
    document.addEventListener('mouseup', handleUp)
  }, [updateTask])

  function handleSaveTask({ title, type, endSlot }) {
    if (!modal) return
    if (modal.task) { updateTask(modal.task.id, { title, type, endSlot }) }
    else            { addTask({ weekKey, dayIdx: modal.dayIdx, startSlot: modal.startSlot, endSlot, title, type }) }
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
          <p className="text-sm text-gray-500 mt-0.5">Grade semanal e resumo mensal</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setWeekOffset(0)} className="text-xs text-blue-600 hover:underline font-medium">Semana atual</button>
          <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg px-2 py-1 shadow-sm">
            <button onClick={() => setWeekOffset(o => o - 1)} className="p-1 rounded hover:bg-gray-100 text-gray-500"><ChevronLeft className="w-4 h-4" /></button>
            <span className="text-sm font-medium text-gray-700 px-2 min-w-[148px] text-center">
              {format(weekDays[0], 'dd/MM')} – {format(weekDays[6], 'dd/MM/yyyy')}
            </span>
            <button onClick={() => setWeekOffset(o => o + 1)} className="p-1 rounded hover:bg-gray-100 text-gray-500"><ChevronRight className="w-4 h-4" /></button>
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
                <div key={i} style={{ height: SLOT_HEIGHT }} className="flex items-center justify-end pr-2 border-b border-r border-gray-100 shrink-0">
                  <span className="text-[10px] text-gray-400 leading-none select-none tabular-nums">{slotToTime(i)}</span>
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
                    <div className={`h-10 sticky top-0 z-20 flex flex-col items-center justify-center border-b border-l border-gray-200 shrink-0 ${isToday ? 'bg-blue-50' : 'bg-gray-50'}`}>
                      <span className={`text-xs font-semibold leading-tight ${isToday ? 'text-blue-700' : 'text-gray-600'}`}>{DAYS_PT[dayIdx]}</span>
                      <span className={`text-[10px] leading-tight ${isToday ? 'text-blue-500' : 'text-gray-400'}`}>{format(day, 'dd/MM')}</span>
                    </div>
                    <div className="relative border-l border-gray-200">
                      {Array.from({ length: TOTAL_SLOTS }, (_, slotIdx) => (
                        <div key={slotIdx} style={{ height: SLOT_HEIGHT }}
                          onClick={() => { if (!dragPreviewRef.current) setModal({ dayIdx, startSlot: slotIdx, task: null }) }}
                          className={`border-b border-gray-100 cursor-pointer transition-colors ${isToday ? 'hover:bg-blue-50/60' : 'hover:bg-gray-50'}`}
                        />
                      ))}
                      {dayTasks.map(task => {
                        const t      = typeMap[task.type] || taskTypes[0]
                        if (!t) return null
                        const blockH    = (task.endSlot - task.startSlot) * SLOT_HEIGHT
                        const isPreview = dragPreview?.id === task.id
                        const bgColor   = task.done ? 'bg-emerald-500' : t.bg
                        return (
                          <div key={task.id}
                            style={{ position: 'absolute', top: task.startSlot * SLOT_HEIGHT + 1, height: blockH - 2, left: 3, right: 3 }}
                            className={`${bgColor} text-white rounded-md text-xs overflow-hidden z-10 shadow-sm select-none pb-3 ${isPreview ? 'opacity-90 ring-2 ring-white/50 cursor-grabbing' : 'cursor-grab'}`}
                            onMouseDown={e => startMove(e, task)}
                            onClick={e => e.stopPropagation()}
                          >
                            <div className="flex items-start gap-0.5 px-1.5 pt-0.5">
                              <div className={`flex-1 min-w-0 font-medium leading-tight break-words ${task.done ? 'line-through opacity-80' : ''}`}>{task.title}</div>
                              <button
                                onMouseDown={e => e.stopPropagation()}
                                onClick={e => { e.stopPropagation(); updateTask(task.id, { done: !task.done }) }}
                                className={`shrink-0 w-4 h-4 rounded-full border border-white/60 flex items-center justify-center transition-colors mt-0.5 ${task.done ? 'bg-white/30' : 'hover:bg-white/20'}`}
                              >
                                {task.done && <Check className="w-2.5 h-2.5" />}
                              </button>
                            </div>
                            {blockH >= 58 && <div className="px-1.5 text-white/75 text-[10px] leading-tight">{slotToTime(task.startSlot)}–{slotToTime(task.endSlot)}</div>}
                            <div className="absolute bottom-0 left-0 right-0 h-3 cursor-ns-resize flex items-center justify-center"
                              onMouseDown={e => startResize(e, task)} onClick={e => e.stopPropagation()}>
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
        <TypeLegend taskTypes={taskTypes} onUpdate={updateTaskType} onAdd={addTaskType} onRemove={removeTaskType} />
      </div>

      {/* Monthly Summary */}
      <MonthlySummary
        summaries={summaries}
        updateSummary={updateSummary}
        summaryLabels={summaryLabels}
        updateSummaryLabel={updateSummaryLabel}
        addSummaryLabel={addSummaryLabel}
        removeSummaryLabel={removeSummaryLabel}
        currentWeekKey={currentWeekKey}
        todayStr={todayStr}
      />

      {modal && (
        <TaskModal
          initial={modal.task ? { ...modal.task } : { startSlot: modal.startSlot, endSlot: Math.min(modal.startSlot + 2, TOTAL_SLOTS) }}
          taskTypes={taskTypes}
          onSave={handleSaveTask}
          onDelete={handleDeleteTask}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
