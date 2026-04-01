import { useState } from 'react'
import { ChevronDown, ChevronRight, AlertCircle, CheckCircle, Search } from 'lucide-react'
import { diagnosePlansSheet } from '../services/sheetsService'

export default function DiagnosticPanel({ offers, apiKey, buyersApiKey }) {
  const [results, setResults] = useState({})
  const [loading, setLoading] = useState(false)

  async function runDiag() {
    setLoading(true)
    const out = {}

    for (const offer of offers) {
      out[offer.id] = { name: offer.name }

      // Aba da oferta
      out[offer.id].offerTab = await diagnosePlansSheet(offer.resultSheetId, offer.resultTab, apiKey)

      // Meta Ads
      out[offer.id].metaTab = await diagnosePlansSheet(offer.metaSheetId, offer.metaTab, apiKey)
    }

    // Compradores
    if (buyersApiKey) {
      const { RESULTADO_GERAL_ID } = await import('../config/defaultConfig')
      out._compradores = await diagnosePlansSheet(RESULTADO_GERAL_ID, 'todos os compradores', buyersApiKey)
    }

    setResults(out)
    setLoading(false)
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-700">Diagnóstico de Planilhas</h3>
          <p className="text-xs text-gray-400 mt-0.5">Mostra os cabeçalhos reais de cada planilha para identificar problemas de parsing</p>
        </div>
        <button
          onClick={runDiag}
          disabled={loading || !apiKey}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          <Search className="w-4 h-4" />
          {loading ? 'Inspecionando...' : 'Inspecionar planilhas'}
        </button>
      </div>

      {Object.keys(results).length > 0 && (
        <div className="space-y-4">
          {Object.entries(results).map(([key, data]) => {
            if (key === '_compradores') return (
              <SheetResult key={key} label="todos os compradores (buyersApiKey)" data={data} />
            )
            return (
              <div key={key} className="border rounded-lg p-3 space-y-2">
                <p className="text-sm font-semibold text-gray-700">{data.name}</p>
                <SheetResult label={`Aba da oferta: ${data.offerTab?.tabName}`} data={data.offerTab} />
                <SheetResult label={`Meta Ads: ${data.metaTab?.tabName}`} data={data.metaTab} />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function SheetResult({ label, data }) {
  const [open, setOpen] = useState(false)
  if (!data) return null

  return (
    <div className="border rounded p-2 text-xs">
      <button className="flex items-center gap-2 w-full text-left" onClick={() => setOpen(o => !o)}>
        {data.ok
          ? <CheckCircle className="w-3.5 h-3.5 text-success shrink-0" />
          : <AlertCircle className="w-3.5 h-3.5 text-danger shrink-0" />
        }
        <span className="font-medium text-gray-700 flex-1">{label}</span>
        {open ? <ChevronDown className="w-3 h-3 text-gray-400" /> : <ChevronRight className="w-3 h-3 text-gray-400" />}
      </button>

      {!data.ok && (
        <p className="mt-1 text-danger ml-5">{data.error}</p>
      )}

      {data.ok && open && (
        <div className="mt-2 ml-5 space-y-2">
          {data.rows && data.rows.length > 0 && (
            <>
              <p className="font-medium text-gray-500">Cabeçalhos (linha 1):</p>
              <div className="flex flex-wrap gap-1">
                {(data.rows[0] || []).map((h, i) => (
                  <span key={i} className="bg-blue-50 border border-blue-200 text-blue-700 px-1.5 py-0.5 rounded font-mono">
                    [{i}] {h}
                  </span>
                ))}
              </div>
              {data.rows.slice(1).map((row, ri) => (
                <div key={ri} className="mt-1">
                  <p className="text-gray-400">Linha {ri + 2}:</p>
                  <div className="flex flex-wrap gap-1">
                    {row.map((v, i) => (
                      <span key={i} className="bg-gray-50 border border-gray-200 text-gray-600 px-1.5 py-0.5 rounded font-mono">
                        [{i}] {v}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </>
          )}
          {(!data.rows || data.rows.length === 0) && (
            <p className="text-gray-400">Aba vazia ou sem dados</p>
          )}
        </div>
      )}
    </div>
  )
}
