import { ReactNode } from 'react'

interface Props {
  title?: string
  message: string
  onClose: () => void
  onConfirm: () => void
  confirmLabel?: string
  loading?: boolean
  children?: ReactNode
}

export default function Modal({ title, message, onClose, onConfirm, confirmLabel = 'Confirmar', loading, children }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="p-6">
          {title && <h2 className="text-lg font-semibold text-gray-800 mb-2">{title}</h2>}
          <p className="text-gray-600 text-sm">{message}</p>
          {children}
        </div>
        <div className="flex gap-3 justify-end px-6 pb-6">
          <button className="btn-secondary" onClick={onClose} disabled={loading}>Cancelar</button>
          <button className="btn-danger" onClick={onConfirm} disabled={loading}>
            {loading ? 'Aguarde...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
