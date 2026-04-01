import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Clientes from './pages/Clientes'
import BaseClientes from './pages/BaseClientes'
import Reservas from './pages/Reservas'
import Viagens from './pages/Viagens'
import Vendedores from './pages/Vendedores'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/reservas" element={<ProtectedRoute><Reservas /></ProtectedRoute>} />
          <Route path="/clientes" element={<ProtectedRoute><BaseClientes /></ProtectedRoute>} />
          <Route path="/clientes-antigos" element={<ProtectedRoute><Clientes /></ProtectedRoute>} />
          <Route path="/viagens" element={<ProtectedRoute><Viagens /></ProtectedRoute>} />
          <Route path="/vendedores" element={<ProtectedRoute apenasAdmin><Vendedores /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
