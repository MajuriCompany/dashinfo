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
