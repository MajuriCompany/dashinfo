import { useState, useEffect, useRef } from 'react'
import { Plus, Edit2, Trash2, PauseCircle, PlayCircle, AlertTriangle, Save, RefreshCw, Upload, Download } from 'lucide-react'
import { useAppConfig } from '../hooks/useAppConfig'
import { useMonthlyGoals } from '../hooks/useMonthlyGoals'
import { getMesAtualKey } from '../utils/dateUtils'
import { fetchAllBuyersProducts } from '../services/sheetsService'
import DiagnosticPanel from '../components/DiagnosticPanel'

const EMPTY_OFFER = {
  id: '', name: '', status: 'active', color: '#2563eb',
  resultSheetId: '', resultTab: '', metaSheetId: '', metaTab: '',
  metaCurrency: 'USD',
  frontProduct: '', otherProducts: [],
}

export default function Settings() {
  const {
    settings, offers, apiKey, buyersApiKey,
    updateSettings, saveApiKey, saveBuyersApiKey,
    addOffer, updateOffer, removeOffer, resetDefaults,
  } = useAppConfig()

  const [localSettings,    setLocalSettings]    = useState(settings)
  const [localApiKey,      setLocalApiKey]      = useState(apiKey)
  const [localBuyersKey,   setLocalBuyersKey]   = useState(buyersApiKey)
  const [showForm,         setShowForm]         = useState(false)
  const [editOffer,        setEditOffer]        = useState(null)
  const [form,             setForm]             = useState(EMPTY_OFFER)
  const [unmapped,         setUnmapped]         = useState([])
  const [buyersProducts,   setBuyersProducts]   = useState([])
  const [loadingBuyers,    setLoadingBuyers]    = useState(false)

  const { goals, setGoals, removeGoals } = useMonthlyGoals()
  const [goalMonth,  setGoalMonth]  = useState(getMesAtualKey)
  const [goalPiso,   setGoalPiso]   = useState('')
  const [goalStretch, setGoalStretch] = useState('')

  const [importText,   setImportText]   = useState('')
  const [importStatus, setImportStatus] = useState(null) // 'ok' | 'error'
  const importRef = useRef(null)

  const EXPORT_KEYS = [
    'dash_settings', 'dash_offers', 'dash_api_key',
    'dash_buyers_api_key', 'dash_credentials', 'dash_monthly_goals',
  ]

  function exportConfig() {
    const data = {}
    EXPORT_KEYS.forEach(k => {
      const v = localStorage.getItem(k)
      if (v != null) data[k] = v
    })
    const code = btoa(unescape(encodeURIComponent(JSON.stringify(data))))
    navigator.clipboard.writeText(code).then(() => {
      alert('Código copiado para a área de transferência!\n\nCole em outro navegador via "Importar configurações".')
    }).catch(() => {
      prompt('Copie este código e cole em outro navegador:', code)
    })
  }

  function importConfig() {
    try {
      const raw  = decodeURIComponent(escape(atob(importText.trim())))
      const data = JSON.parse(raw)
      let count = 0
      EXPORT_KEYS.forEach(k => {
        if (data[k] != null) { localStorage.setItem(k, data[k]); count++ }
      })
      setImportStatus('ok')
      setTimeout(() => window.location.reload(), 1200)
    } catch {
      setImportStatus('error')
    }
  }

  // Populate form when month changes
  useEffect(() => {
    const g = goals[goalMonth]
    setGoalPiso(g?.piso   != null ? String(g.piso)    : '')
    setGoalStretch(g?.stretch != null ? String(g.stretch) : '')
  }, [goalMonth, goals])

  async function checkBuyersProducts(key) {
    if (!key) return
    setLoadingBuyers(true)
    const products = await fetchAllBuyersProducts(key)
    setBuyersProducts(products)
    const allMapped = offers.flatMap(o => [o.frontProduct, ...(o.otherProducts || [])]).filter(Boolean)
    const notMapped = products.filter(p => !allMapped.some(m => m.toLowerCase() === p.toLowerCase()))
    setUnmapped(notMapped)
    setLoadingBuyers(false)
  }

  useEffect(() => {
    if (buyersApiKey) checkBuyersProducts(buyersApiKey)
  }, [buyersApiKey, offers])

  function saveSettings() {
    updateSettings(localSettings)
    saveApiKey(localApiKey)
    saveBuyersApiKey(localBuyersKey)
    alert('Configurações salvas!')
  }

  function openAddForm() {
    setForm(EMPTY_OFFER)
    setEditOffer(null)
    setShowForm(true)
  }

  function openEditForm(offer) {
    setForm({ ...offer, otherProducts: offer.otherProducts || [] })
    setEditOffer(offer.id)
    setShowForm(true)
  }

  function submitForm() {
    const offer = {
      ...form,
      id: form.id || form.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''),
      otherProducts: typeof form.otherProducts === 'string'
        ? form.otherProducts.split(',').map(s => s.trim()).filter(Boolean)
        : form.otherProducts,
    }
    if (editOffer) updateOffer(editOffer, offer)
    else addOffer(offer)
    setShowForm(false)
  }

  const activeOffers = offers.filter(o => o.status === 'active')
  const pausedOffers = offers.filter(o => o.status !== 'active')

  return (
    <div className="space-y-6 max-w-3xl">
      <h2 className="text-lg font-bold text-gray-800">Configurações</h2>

      {/* Aviso de produtos sem vínculo */}
      {unmapped.length > 0 && (
        <div className="flex items-start gap-3 bg-yellow-50 border border-yellow-300 rounded-lg p-4">
          <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-yellow-800">{unmapped.length} produto(s) sem vínculo em "todos os compradores"</p>
            <p className="text-xs text-yellow-700 mt-1">
              Configure o nome exato do produto em cada oferta abaixo:<br />
              <span className="font-mono bg-yellow-100 px-1 rounded">{unmapped.join(' | ')}</span>
            </p>
          </div>
        </div>
      )}

      {/* Parâmetros mensais */}
      <div className="bg-white rounded-lg shadow-sm p-5 space-y-4">
        <h3 className="font-semibold text-gray-700">Parâmetros Mensais</h3>
        <div className="grid grid-cols-2 gap-4">
          {[
            { key: 'usdRate',     label: 'Cotação do Dólar (R$)',  step: '0.01' },
            { key: 'aliquota',    label: 'Alíquota de Imposto (%)', step: '0.1',
              display: v => (v * 100).toFixed(1), parse: v => parseFloat(v) / 100 },
            { key: 'metaPiso',    label: 'Meta Piso (R$)',          step: '100' },
            { key: 'metaStretch', label: 'Meta Real (R$)',           step: '100' },
          ].map(({ key, label, step, display, parse }) => (
            <div key={key}>
              <label className="text-xs text-gray-500 block mb-1">{label}</label>
              <input
                type="number"
                step={step}
                className="border rounded px-3 py-1.5 text-sm w-full"
                value={display ? display(localSettings[key]) : localSettings[key]}
                onChange={e => setLocalSettings(p => ({
                  ...p,
                  [key]: parse ? parse(e.target.value) : parseFloat(e.target.value),
                }))}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Metas por Mês */}
      <div className="bg-white rounded-lg shadow-sm p-5 space-y-4">
        <h3 className="font-semibold text-gray-700">Metas por Mês</h3>
        <p className="text-xs text-gray-400 -mt-2">
          Defina Meta Piso e Meta Real independente para cada mês comercial (dia 3 ao dia 2).
          Se não houver meta salva para um mês, os valores padrão acima são usados.
        </p>

        {/* Month picker + inputs */}
        <div className="grid grid-cols-3 gap-3 items-end">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Mês (AAAA-MM)</label>
            <input
              type="month"
              className="border rounded px-3 py-1.5 text-sm w-full"
              value={goalMonth}
              onChange={e => setGoalMonth(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Meta Piso (R$)</label>
            <input
              type="number" step="100"
              className="border rounded px-3 py-1.5 text-sm w-full"
              placeholder="ex: 8000"
              value={goalPiso}
              onChange={e => setGoalPiso(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Meta Real (R$)</label>
            <input
              type="number" step="100"
              className="border rounded px-3 py-1.5 text-sm w-full"
              placeholder="ex: 12000"
              value={goalStretch}
              onChange={e => setGoalStretch(e.target.value)}
            />
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              if (goalPiso || goalStretch) setGoals(goalMonth, Number(goalPiso) || 0, Number(goalStretch) || 0)
            }}
            className="px-4 py-1.5 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700"
          >
            Salvar meta do mês
          </button>
          {goals[goalMonth] && (
            <button
              onClick={() => removeGoals(goalMonth)}
              className="px-4 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded text-xs font-medium hover:bg-red-100"
            >
              Remover
            </button>
          )}
        </div>

        {/* List of saved goals */}
        {Object.keys(goals).length > 0 && (
          <div className="mt-2 border rounded-lg divide-y">
            {Object.entries(goals)
              .sort(([a], [b]) => b.localeCompare(a))
              .map(([month, g]) => (
                <div
                  key={month}
                  className={`flex items-center justify-between px-3 py-2 text-xs cursor-pointer hover:bg-gray-50 ${month === goalMonth ? 'bg-blue-50' : ''}`}
                  onClick={() => setGoalMonth(month)}
                >
                  <span className="font-medium text-gray-700">{month}</span>
                  <span className="text-gray-500">
                    Piso: R$ {g.piso?.toLocaleString('pt-BR')} · Real: R$ {g.stretch?.toLocaleString('pt-BR')}
                  </span>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* API Keys */}
      <div className="bg-white rounded-lg shadow-sm p-5 space-y-4">
        <h3 className="font-semibold text-gray-700">API Google Sheets</h3>

        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">
            Chave principal (planilhas das ofertas + Meta Ads)
          </label>
          <input
            type="text"
            placeholder="AIza..."
            className="border rounded px-3 py-1.5 text-sm w-full font-mono"
            value={localApiKey}
            onChange={e => setLocalApiKey(e.target.value)}
          />
          <p className="text-xs text-gray-400 mt-1">
            Acesse console.cloud.google.com → Ativar Google Sheets API → Criar chave de API
          </p>
        </div>

        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">
            Chave da conta "RESULTADO LOW TICKET" — para "todos os compradores" (faturamento)
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="AIza... (outro email)"
              className="border rounded px-3 py-1.5 text-sm flex-1 font-mono"
              value={localBuyersKey}
              onChange={e => setLocalBuyersKey(e.target.value)}
            />
            <button
              onClick={() => checkBuyersProducts(localBuyersKey)}
              disabled={!localBuyersKey || loadingBuyers}
              className="px-3 py-1.5 bg-gray-100 border rounded text-xs text-gray-600 hover:bg-gray-200 disabled:opacity-50 flex items-center gap-1"
            >
              <RefreshCw className={`w-3 h-3 ${loadingBuyers ? 'animate-spin' : ''}`} />
              Testar
            </button>
          </div>
          {buyersProducts.length > 0 && (
            <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-xs text-green-700">
              {buyersProducts.length} produtos encontrados: {buyersProducts.join(', ')}
            </div>
          )}
          <p className="text-xs text-gray-400 mt-1">
            A planilha "Resultado Geral" deve estar compartilhada com "Qualquer pessoa com o link → Visualizador"
            na conta RESULTADO LOW TICKET
          </p>
        </div>
      </div>

      <button
        onClick={saveSettings}
        className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
      >
        <Save className="w-4 h-4" />
        Salvar configurações
      </button>

      {/* Gerenciar Ofertas */}
      <div className="bg-white rounded-lg shadow-sm p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-700">Gerenciar Ofertas</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              "Nome do produto" = nome exato como aparece na coluna Produto de "todos os compradores"
            </p>
          </div>
          <button
            onClick={openAddForm}
            className="flex items-center gap-1 px-3 py-1 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700"
          >
            <Plus className="w-3 h-3" /> Nova oferta
          </button>
        </div>

        {showForm && (
          <div className="border rounded-lg p-4 bg-gray-50 space-y-3">
            <p className="text-sm font-medium text-gray-700">{editOffer ? 'Editar' : 'Nova'} oferta</p>
            <div className="grid grid-cols-2 gap-3 text-xs">
              {[
                { key: 'name',         label: 'Nome da oferta' },
                { key: 'resultTab',    label: 'Aba no Resultado Geral' },
                { key: 'metaSheetId',  label: 'ID Planilha Meta Ads' },
                { key: 'metaTab',      label: 'Aba Meta (ex: Página1)' },
                { key: 'frontProduct', label: 'Nome do produto em "todos os compradores"' },
              ].map(({ key, label }) => (
                <div key={key} className={key === 'frontProduct' ? 'col-span-2' : ''}>
                  <label className="text-gray-500 block mb-0.5">{label}</label>
                  <input
                    className="border rounded px-2 py-1 w-full text-xs"
                    value={form[key] || ''}
                    onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                  />
                </div>
              ))}
              <div className="col-span-2">
                <label className="text-gray-500 block mb-0.5">
                  Order bumps / upsells (nomes exatos separados por vírgula)
                </label>
                <input
                  className="border rounded px-2 py-1 w-full text-xs"
                  placeholder="ex: Bump Reconquista, Upsell VIP"
                  value={Array.isArray(form.otherProducts) ? form.otherProducts.join(', ') : form.otherProducts || ''}
                  onChange={e => setForm(p => ({ ...p, otherProducts: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-gray-500 block mb-0.5">Moeda do Meta Ads</label>
                <select
                  className="border rounded px-2 py-1 w-full text-xs"
                  value={form.metaCurrency || 'USD'}
                  onChange={e => setForm(p => ({ ...p, metaCurrency: e.target.value }))}
                >
                  <option value="USD">USD — converte pelo dólar configurado</option>
                  <option value="BRL">BRL — já está em reais, não converter</option>
                </select>
              </div>
              <div>
                <label className="text-gray-500 block mb-0.5">Cor</label>
                <input
                  type="color"
                  className="border rounded h-8 w-12"
                  value={form.color || '#2563eb'}
                  onChange={e => setForm(p => ({ ...p, color: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-gray-500 block mb-0.5">Status</label>
                <select
                  className="border rounded px-2 py-1 w-full text-xs"
                  value={form.status}
                  onChange={e => setForm(p => ({ ...p, status: e.target.value }))}
                >
                  <option value="active">Ativa</option>
                  <option value="paused">Pausada</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={submitForm} className="px-3 py-1 bg-blue-600 text-white rounded text-xs">Salvar</button>
              <button onClick={() => setShowForm(false)} className="px-3 py-1 bg-gray-200 text-gray-700 rounded text-xs">Cancelar</button>
            </div>
          </div>
        )}

        {[...activeOffers, ...pausedOffers].map(offer => (
          <div key={offer.id} className="flex items-center justify-between py-2 border-b last:border-0">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: offer.color }} />
              <div className="min-w-0">
                <span className="text-sm text-gray-800">{offer.name}</span>
                {offer.frontProduct && (
                  <span className="text-xs text-gray-400 ml-2 font-mono">"{offer.frontProduct}"</span>
                )}
              </div>
              <span className={`text-xs px-1.5 py-0.5 rounded shrink-0 ${offer.status === 'active' ? 'bg-success-light text-success' : 'bg-gray-100 text-gray-500'}`}>
                {offer.status === 'active' ? 'Ativa' : 'Pausada'}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={() => openEditForm(offer)} className="p-1 text-gray-400 hover:text-gray-700">
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => updateOffer(offer.id, { status: offer.status === 'active' ? 'paused' : 'active' })}
                className="p-1 text-gray-400 hover:text-gray-700"
              >
                {offer.status === 'active' ? <PauseCircle className="w-3.5 h-3.5" /> : <PlayCircle className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={() => { if (confirm(`Remover "${offer.name}"?`)) removeOffer(offer.id) }}
                className="p-1 text-gray-400 hover:text-red-500"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <DiagnosticPanel offers={offers} apiKey={apiKey} buyersApiKey={buyersApiKey} />

      {/* Exportar / Importar configurações */}
      <div className="bg-white rounded-lg shadow-sm p-5 space-y-4">
        <h3 className="font-semibold text-gray-700">Sincronizar com outro navegador</h3>
        <p className="text-xs text-gray-400 -mt-2">
          Exporte um código com todas as configurações (login, chaves de API, ofertas, metas)
          e importe em qualquer outro navegador ou dispositivo.
        </p>

        <button
          onClick={exportConfig}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
        >
          <Download className="w-4 h-4" />
          Exportar configurações
        </button>

        <div className="space-y-2">
          <label className="text-xs text-gray-500 block">Colar código de outro dispositivo:</label>
          <textarea
            ref={importRef}
            rows={3}
            placeholder="Cole aqui o código exportado de outro navegador..."
            className="border rounded px-3 py-2 text-xs w-full font-mono resize-none"
            value={importText}
            onChange={e => { setImportText(e.target.value); setImportStatus(null) }}
          />
          {importStatus === 'ok' && (
            <p className="text-xs text-green-600 font-medium">Configurações importadas! Recarregando...</p>
          )}
          {importStatus === 'error' && (
            <p className="text-xs text-red-500">Código inválido. Certifique-se de copiar o código completo.</p>
          )}
          <button
            onClick={importConfig}
            disabled={!importText.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40"
          >
            <Upload className="w-4 h-4" />
            Importar e recarregar
          </button>
        </div>
      </div>

      <button
        onClick={() => { if (confirm('Restaurar todos os padrões? Isso vai resetar ofertas e configurações.')) resetDefaults() }}
        className="text-xs text-red-500 hover:text-red-700 underline"
      >
        Restaurar padrões de fábrica
      </button>
    </div>
  )
}
