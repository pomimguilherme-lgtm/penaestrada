import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { ReactNode } from 'react'

interface Props {
  children: ReactNode
  apenasAdmin?: boolean
}

export default function ProtectedRoute({ children, apenasAdmin }: Props) {
  const { usuario, isAdmin } = useAuth()
  if (!usuario) return <Navigate to="/login" replace />
  if (apenasAdmin && !isAdmin) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}
