import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import logoIcon from '../assets/logo-icon.png'

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: '📊', roles: ['admin', 'vendedor'] },
  { to: '/reservas', label: 'Reservas', icon: '📋', roles: ['admin', 'vendedor'] },
  { to: '/clientes', label: 'Clientes', icon: '👤', roles: ['admin', 'vendedor'] },
  { to: '/viagens', label: 'Viagens', icon: '✈️', roles: ['admin', 'vendedor'] },
  { to: '/vendedores', label: 'Vendedores', icon: '🧑‍💼', roles: ['admin'] },
]

interface Props {
  open: boolean
  onClose: () => void
}

export default function Sidebar({ open, onClose }: Props) {
  const { usuario, logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-20 md:hidden"
          onClick={onClose}
        />
      )}
      <aside
        className={`fixed top-0 left-0 h-full w-64 bg-blue-900 text-white flex flex-col z-30 transform transition-transform duration-200
          ${open ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 md:static md:flex`}
      >
        <div className="flex items-center gap-3 px-5 py-4 border-b border-blue-800">
          <img
            src={logoIcon}
            alt="Pé na Estrada"
            className="w-9 h-9 object-contain shrink-0"
            style={{ imageRendering: 'auto' }}
          />
          <div>
            <div className="font-bold text-sm leading-tight">Pé na Estrada</div>
            <div className="text-xs text-blue-300">Gestão de Viagens</div>
          </div>
        </div>

        <div className="px-4 py-3 border-b border-blue-800">
          <div className="text-xs text-blue-400 uppercase tracking-wider mb-1">Logado como</div>
          <div className="font-medium text-sm truncate">{usuario?.nome}</div>
          <span className={`text-xs px-2 py-0.5 rounded-full ${usuario?.tipo === 'admin' ? 'bg-amber-500 text-amber-900' : 'bg-blue-600 text-white'}`}>
            {usuario?.tipo === 'admin' ? 'Administrador' : 'Vendedor'}
          </span>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems
            .filter((item) => item.roles.includes(usuario?.tipo || ''))
            .map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                   ${isActive ? 'bg-blue-700 text-white' : 'text-blue-100 hover:bg-blue-800'}`
                }
              >
                <span className="text-base">{item.icon}</span>
                {item.label}
              </NavLink>
            ))}
        </nav>

        <div className="p-4 border-t border-blue-800">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-blue-200 hover:bg-blue-800 hover:text-white transition-colors"
          >
            <span>🚪</span> Sair
          </button>
        </div>
      </aside>
    </>
  )
}
