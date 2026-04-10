import { useState } from 'react'
import { useAppConfig } from '../hooks/useAppConfig'

const BASE = 'https://sheets.googleapis.com/v4/spreadsheets'

async function rawFetch(sheetId, tab, apiKey) {
  const safeTab = tab.includes(' ') ? `'${tab}'` : tab
  const range = `${safeTab}!A:Z`
  const encodedRange = range.replace(/ /g, '%20')
  const url = `${BASE}/${sheetId}/values/${encodedRange}?key=${apiKey}&valueRenderOption=FORMATTED_VALUE`
  const res = await fetch(url)
  const json = await res.json()
  if (!res.ok) return { error: json.error?.message || res.statusText, rows: [] }
  return { rows: json.values || [] }
}

export default function Debug() {
  const { offers, apiKey, buyersApiKey, settings } = useAppConfig()
  const [selected, setSelected]   = useState(offers[0]?.id || '')
  const [result, setResult]       = useState(null)
  const [loading, setLoading]     = useState(false)

  const offer = offers.find(o => o.id === selected)

  async function run() {
    if (!offer || !apiKey) return
    setLoading(true)
    setResult(null)

    const [metaRes, offerRes, buyersRes] = await Promise.all([
      rawFetch(offer.metaSheetId, offer.metaTab, apiKey),
      rawFetch(offer.resultSheetId, offer.resultTab, apiKey),
      buyersApiKey
        ? rawFetch('1bM-PoeZ7HDMLfuFP-zBp5HaHWndLnqkOXFXlYxxn4K0', 'todos compradores', buyersApiKey)
        : Promise.resolve({ rows: [], error: 'buyersApiKey não configurada' }),
    ])

    setResult({ metaRes, offerRes, buyersRes })
    setLoading(false)
  }

  return (
    <div className="space-y-6 max-w-full">
      <h2 className="text-lg font-bold text-gray-800">Debug — Dados Brutos</h2>
      <p className="text-sm text-gray-500">Mostra exatamente o que a API retorna, sem nenhum processamento.</p>

      <div className="flex items-center gap-3">
        <select
          value={selected}
          onChange={e => setSelected(e.target.value)}
          className="border rounded px-3 py-1.5 text-sm"
        >
          {offers.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
        <button
          onClick={run}
          disabled={loading || !apiKey}
          className="px-4 py-1.5 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Buscando...' : 'Buscar dados brutos'}
        </button>
        {!apiKey && <span className="text-red-500 text-sm">API key não configurada</span>}
      </div>

      {offer && (
        <div className="text-xs bg-gray-50 border rounded p-3 space-y-1">
          <p><strong>Meta sheet:</strong> {offer.metaSheetId} / {offer.metaTab}</p>
          <p><strong>Offer tab:</strong> {offer.resultSheetId} / {offer.resultTab}</p>
          <p><strong>frontProduct:</strong> {
            (Array.isArray(offer.frontProduct) ? offer.frontProduct : (offer.frontProduct ? [offer.frontProduct] : [])).filter(Boolean).join(', ') || '⚠️ NÃO CONFIGURADO'
          }</p>
          <p><strong>metaCurrency:</strong> {offer.metaCurrency || 'USD'} | <strong>usdRate:</strong> {settings.usdRate}</p>
          <p><strong>buyersApiKey:</strong> {buyersApiKey ? '✅ configurada' : '⚠️ não configurada'}</p>
        </div>
      )}

      {result && (
        <div className="space-y-6">
          <RawTable title="📊 META ADS — primeiras 10 linhas" data={result.metaRes} />
          <RawTable title="📋 ABA DA OFERTA — primeiras 10 linhas" data={result.offerRes} />
          <RawTable title="🛒 TODOS OS COMPRADORES — primeiras 10 linhas" data={result.buyersRes} />
        </div>
      )}
    </div>
  )
}

function RawTable({ title, data }) {
  if (!data) return null
  const { rows, error } = data

  return (
    <div className="bg-white rounded-lg shadow-sm p-4">
      <h3 className="font-semibold text-gray-700 mb-3">{title}</h3>

      {error && (
        <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded p-3">
          ❌ Erro: {error}
        </div>
      )}

      {rows.length === 0 && !error && (
        <p className="text-gray-400 text-sm">Nenhum dado retornado.</p>
      )}

      {rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="text-xs border-collapse w-full">
            <thead>
              <tr className="bg-blue-50">
                <th className="border px-2 py-1 text-left text-gray-500">#</th>
                {rows[0].map((h, i) => (
                  <th key={i} className="border px-2 py-1 text-left font-mono text-blue-700 whitespace-nowrap">
                    [{i}] {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Últimas 15 linhas (dados mais recentes) */}
              {rows.slice(Math.max(1, rows.length - 15)).map((row, ri, arr) => {
                const absIdx = rows.length - arr.length + ri
                return (
                  <tr key={ri} className={ri % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="border px-2 py-1 text-gray-400">{absIdx + 1}</td>
                    {row.map((cell, ci) => (
                      <td key={ci} className="border px-2 py-1 font-mono text-gray-700 whitespace-nowrap">
                        {cell}
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
          <p className="text-xs text-gray-400 mt-1">Mostrando últimas 15 de {rows.length} linhas totais</p>
        </div>
      )}
    </div>
  )
}
