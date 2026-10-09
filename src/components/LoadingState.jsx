import { AlertCircle, Key, RefreshCw } from 'lucide-react'

export function Spinner() {
  return (
    <div className="flex items-center justify-center h-48">
      <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
    </div>
  )
}

export function NoApiKey() {
  return (
    <div className="flex flex-col items-center justify-center h-48 gap-3 text-center">
      <Key className="w-10 h-10 text-gray-400" />
      <p className="text-gray-600 font-medium">Chave de API não configurada</p>
      <p className="text-gray-400 text-sm">Acesse <a href="/config" className="text-blue-600 underline">Configurações</a> para inserir a chave do Google Sheets.</p>
    </div>
  )
}

export function ErrorState({ message }) {
  return (
    <div className="flex flex-col items-center justify-center h-48 gap-3 text-center">
      <AlertCircle className="w-10 h-10 text-red-400" />
      <p className="text-red-600 font-medium">Erro ao carregar dados</p>
      <p className="text-gray-400 text-sm">{message}</p>
    </div>
  )
}

export function EmptyState({ message = 'Nenhum dado encontrado para o período.' }) {
  return (
    <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
      {message}
    </div>
  )
}

// Aviso discreto quando alguma planilha não atualizou — os números mostrados são do último carregamento bom.
export function DataWarnings({ warnings, onRetry, loading }) {
  if (!warnings?.length) return null
  return (
    <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
      <div className="flex-1">
        <span className="font-medium">Não atualizou: </span>
        {warnings.join(' · ')}
        <span className="text-amber-700"> — mostrando o último valor carregado.</span>
      </div>
      <button
        onClick={onRetry}
        disabled={loading}
        className="flex items-center gap-1 shrink-0 font-medium text-amber-900 hover:underline disabled:opacity-50"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        Tentar de novo
      </button>
    </div>
  )
}
