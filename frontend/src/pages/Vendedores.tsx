import { useEffect, useState, FormEvent } from 'react'
import Layout from '../components/Layout'
import Modal from '../components/Modal'
import api from '../services/api'
import { useAuth } from '../contexts/AuthContext'

interface Usuario {
  id: number
  nome: string
  email: string
  tipo: 'admin' | 'vendedor'
  status: 'ativo' | 'inativo'
}

const empty = { nome: '', email: '', senha: '', status: 'ativo' as 'ativo' | 'inativo' }

export default function Vendedores() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [form, setForm] = useState(empty)
  const [editando, setEditando] = useState<Usuario | null>(null)
  const [deletando, setDeletando] = useState<Usuario | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [alterandoId, setAlterandoId] = useState<number | null>(null)
  const [toast, setToast] = useState('')
  const [erro, setErro] = useState('')
  const { usuario } = useAuth()

  useEffect(() => { carregar() }, [])

  function carregar() {
    api.get('/vendedores').then((r) => setUsuarios(r.data))
  }

  function mostrarToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3500)
  }

  function abrirNovo() {
    setForm(empty)
    setEditando(null)
    setErro('')
    setShowForm(true)
  }

  function abrirEditar(u: Usuario) {
    setForm({ nome: u.nome, email: u.email, senha: '', status: u.status })
    setEditando(u)
    setErro('')
    setShowForm(true)
  }

  async function toggleTipo(u: Usuario) {
    setAlterandoId(u.id)
    try {
      const r = await api.patch(`/vendedores/${u.id}/tipo`, {})
      mostrarToast(`${r.data.mensagem} — O usuário deve fazer logout e login novamente para que as permissões sejam aplicadas.`)
      carregar()
    } catch (err: any) {
      mostrarToast(err.response?.data?.erro || 'Erro ao alterar permissão')
    } finally {
      setAlterandoId(null)
    }
  }

  async function salvar(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setErro('')
    try {
      const payload: any = { nome: form.nome, email: form.email, status: form.status }
      if (form.senha) payload.senha = form.senha
      if (editando) {
        await api.put(`/vendedores/${editando.id}`, payload)
      } else {
        if (!form.senha) { setErro('Senha obrigatória'); setLoading(false); return }
        await api.post('/vendedores', { ...payload, senha: form.senha })
      }
      setShowForm(false)
      carregar()
    } catch (err: any) {
      setErro(err.response?.data?.erro || 'Erro ao salvar')
    } finally {
      setLoading(false)
    }
  }

  async function deletar() {
    if (!deletando) return
    setLoading(true)
    try {
      await api.delete(`/vendedores/${deletando.id}`)
      setDeletando(null)
      carregar()
    } catch (err: any) {
      mostrarToast(err.response?.data?.erro || 'Erro ao excluir')
    } finally {
      setLoading(false)
    }
  }

  const admins = usuarios.filter(u => u.tipo === 'admin')
  const vendedores = usuarios.filter(u => u.tipo === 'vendedor')

  function TabelaUsuarios({ lista, titulo }: { lista: Usuario[], titulo: string }) {
    return (
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">{titulo}</h2>
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Nome</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Tipo</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {lista.length === 0 && (
                  <tr><td colSpan={5} className="text-center py-8 text-gray-400">Nenhum usuário.</td></tr>
                )}
                {lista.map((u) => {
                  const ehEuMesmo = u.id === usuario?.id
                  return (
                    <tr key={u.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-800">
                        {u.nome}
                        {ehEuMesmo && <span className="ml-2 text-xs text-blue-500">(você)</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-500">{u.email}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                          u.tipo === 'admin'
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}>
                          {u.tipo === 'admin' ? 'Admin' : 'Vendedor'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          u.status === 'ativo' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {u.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2 flex-wrap">
                          <button className="btn-secondary text-xs" onClick={() => abrirEditar(u)}>Editar</button>
                          {!ehEuMesmo && (
                            <button
                              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-50 ${
                                u.tipo === 'admin'
                                  ? 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100'
                                  : 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100'
                              }`}
                              onClick={() => toggleTipo(u)}
                              disabled={alterandoId === u.id}
                            >
                              {alterandoId === u.id ? '...' : u.tipo === 'admin' ? 'Remover Admin' : 'Tornar Admin'}
                            </button>
                          )}
                          {!ehEuMesmo && (
                            <button className="btn-danger text-xs" onClick={() => setDeletando(u)}>Excluir</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }

  return (
    <Layout titulo="Usuários">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-blue-600 text-white px-5 py-3 rounded-xl shadow-lg text-sm font-medium">
          {toast}
        </div>
      )}

      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <p className="text-sm text-gray-500">
            {admins.length} admin(s) · {vendedores.length} vendedor(es)
          </p>
          <button className="btn-primary" onClick={abrirNovo}>+ Novo Usuário</button>
        </div>

        <TabelaUsuarios lista={admins} titulo="Administradores" />
        <TabelaUsuarios lista={vendedores} titulo="Vendedores" />
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-6">
              <h2 className="text-lg font-semibold mb-4">{editando ? 'Editar Usuário' : 'Novo Usuário'}</h2>
              {erro && <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{erro}</div>}
              <form onSubmit={salvar} className="space-y-3">
                <div>
                  <label className="label">Nome</label>
                  <input className="input" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required />
                </div>
                <div>
                  <label className="label">Email</label>
                  <input type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
                </div>
                <div>
                  <label className="label">{editando ? 'Nova Senha (deixe em branco para manter)' : 'Senha'}</label>
                  <input type="password" className="input" value={form.senha} onChange={(e) => setForm({ ...form, senha: e.target.value })} placeholder={editando ? '••••••••' : ''} />
                </div>
                <div>
                  <label className="label">Status</label>
                  <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as 'ativo' | 'inativo' })}>
                    <option value="ativo">Ativo</option>
                    <option value="inativo">Inativo</option>
                  </select>
                </div>
                <div className="flex gap-3 justify-end pt-2">
                  <button type="button" className="btn-secondary" onClick={() => setShowForm(false)} disabled={loading}>Cancelar</button>
                  <button type="submit" className="btn-primary" disabled={loading}>{loading ? 'Salvando...' : 'Salvar'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {deletando && (
        <Modal
          title="Excluir Usuário"
          message={`Deseja excluir "${deletando.nome}"? Esta ação não pode ser desfeita.`}
          onClose={() => setDeletando(null)}
          onConfirm={deletar}
          confirmLabel="Excluir"
          loading={loading}
        />
      )}
    </Layout>
  )
}
