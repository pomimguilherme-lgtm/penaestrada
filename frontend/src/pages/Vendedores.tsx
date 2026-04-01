import { useEffect, useState, FormEvent } from 'react'
import Layout from '../components/Layout'
import Modal from '../components/Modal'
import api from '../services/api'

interface Vendedor {
  id: number
  nome: string
  email: string
  status: 'ativo' | 'inativo'
}

const empty = { nome: '', email: '', senha: '', status: 'ativo' as 'ativo' | 'inativo' }

export default function Vendedores() {
  const [vendedores, setVendedores] = useState<Vendedor[]>([])
  const [form, setForm] = useState(empty)
  const [editando, setEditando] = useState<Vendedor | null>(null)
  const [deletando, setDeletando] = useState<Vendedor | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => { carregar() }, [])

  function carregar() {
    api.get('/vendedores').then((r) => setVendedores(r.data))
  }

  function abrirNovo() {
    setForm(empty)
    setEditando(null)
    setErro('')
    setShowForm(true)
  }

  function abrirEditar(v: Vendedor) {
    setForm({ nome: v.nome, email: v.email, senha: '', status: v.status })
    setEditando(v)
    setErro('')
    setShowForm(true)
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
        if (!form.senha) { setErro('Senha obrigatoria'); setLoading(false); return }
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
    } finally {
      setLoading(false)
    }
  }

  return (
    <Layout titulo="Vendedores">
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <p className="text-sm text-gray-500">{vendedores.length} vendedor(es)</p>
          <button className="btn-primary" onClick={abrirNovo}>+ Novo Vendedor</button>
        </div>

        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Nome</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Acoes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {vendedores.length === 0 && (
                  <tr><td colSpan={4} className="text-center py-8 text-gray-400">Nenhum vendedor cadastrado.</td></tr>
                )}
                {vendedores.map((v) => (
                  <tr key={v.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">{v.nome}</td>
                    <td className="px-4 py-3 text-gray-500">{v.email}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${v.status === 'ativo' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                        {v.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button className="btn-secondary text-xs" onClick={() => abrirEditar(v)}>Editar</button>
                        <button className="btn-danger text-xs" onClick={() => setDeletando(v)}>Excluir</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-6">
              <h2 className="text-lg font-semibold mb-4">{editando ? 'Editar Vendedor' : 'Novo Vendedor'}</h2>
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
          title="Excluir Vendedor"
          message={`Deseja excluir o vendedor "${deletando.nome}"?`}
          onClose={() => setDeletando(null)}
          onConfirm={deletar}
          confirmLabel="Excluir"
          loading={loading}
        />
      )}
    </Layout>
  )
}
