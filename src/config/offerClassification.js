// Classificação manual de cada oferta (Configurações) — usada no agregado da aba Tarefas

export const TIPO_OPTIONS = [
  { value: 'modelado',       label: 'Modelado',              color: '#7c3aed' },
  { value: 'modelado_ruim',  label: 'Modelado - oferta ruim', color: '#c084fc' },
  { value: 'outras_linguas', label: 'Outras línguas',        color: '#0891b2' },
  { value: 'nao_valeu',      label: 'Não valeu',             color: '#9ca3af' },
  { value: 'escrito_100',    label: '100% escrito',          color: '#2563eb' },
  { value: 'escrito_medio',  label: 'Escrito mais ou menos', color: '#f59e0b' },
]

export const RESULTADO_OPTIONS = [
  { value: 'ruim',      label: 'Deu ruim',      color: '#dc2626' },
  { value: 'medio',     label: 'Deu médio',     color: '#f59e0b' },
  { value: 'bom',       label: 'Deu bom',       color: '#3b82f6' },
  { value: 'muito_bom', label: 'Deu muito bom', color: '#16a34a' },
]

export function optionLabel(options, value) {
  return options.find(o => o.value === value)?.label || null
}
