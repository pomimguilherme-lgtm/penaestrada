import { useEffect, useState, FormEvent } from 'react'
import Layout from '../components/Layout'
import api from '../services/api'

interface Cliente {
  id: number
  nome: string
  cpf: string
  rg: string
  data_nascimento: string
  telefone: string
  email: string
  observacoes: string
}

const empty: Omit<Cliente, 'id'> = { nome: '', cpf: '', rg: '', data_nascimento: '', telefone: '', email: '', observacoes: '' }

export default function BaseClientes() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [busca, setBusca] = useState('')
  const [form, setForm] = useState<Omit<Cliente, 'id'>>(empty)
  const [editando, setEditando] = useState<Cliente | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [deletando, setDeletando] = useState<Cliente | null>(null)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [toast, setToast] = useState('')
  const [modo, setModo] = useState<'completo' | 'nome'>(() =>
    (localStorage.getItem('clientes_modo') as 'completo' | 'nome') || 'completo'
  )

  function alterarModo(m: 'completo' | 'nome') {
    setModo(m); localStorage.setItem('clientes_modo', m)
  }

  useEffect(() => { carregar() }, [busca])

  function carregar() {
    api.get('/base-clientes', { params: { busca: busca || undefined } })
      .then(r => setClientes(r.data))
  }

  function mostrarToast(msg: string) {
    setToast(msg); setTimeout(() => setToast(''), 3000)
  }

  function abrirNovo() {
    setForm(empty); setEditando(null); setErro(''); setShowForm(true)
  }

  function abrirEditar(c: Cliente) {
    setForm({ nome: c.nome, cpf: c.cpf || '', rg: c.rg || '', data_nascimento: c.data_nascimento || '', telefone: c.telefone || '', email: c.email || '', observacoes: c.observacoes || '' })
    setEditando(c); setErro(''); setShowForm(true)
  }

  async function salvar(e: FormEvent) {
    e.preventDefault(); setLoading(true); setErro('')
    try {
      if (editando) await api.put(`/base-clientes/${editando.id}`, form)
      else await api.post('/base-clientes', form)
      setShowForm(false); carregar()
    } catch (err: any) { setErro(err.response?.data?.erro || 'Erro ao salvar') }
    finally { setLoading(false) }
  }

  async function deletar() {
    if (!deletando) return; setLoading(true)
    try {
      await api.delete(`/base-clientes/${deletando.id}`)
      setDeletando(null); carregar(); mostrarToast('Cliente removido')
    } catch (err: any) { setErro(err.response?.data?.erro || 'Erro ao remover'); setDeletando(null) }
    finally { setLoading(false) }
  }

  return (
    <Layout titulo="Clientes">
      {toast && <div className="fixed top-4 right-4 z-50 bg-blue-600 text-white px-5 py-3 rounded-xl shadow-lg text-sm font-medium">{toast}</div>}

      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
          <input
            className="input max-w-xs"
            placeholder="Buscar por nome, CPF, telefone..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
          />
          <div className="flex items-center gap-3">
            {/* Botões de modo */}
            <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-medium">
              <button
                onClick={() => alterarModo('completo')}
                className={`px-3 py-1.5 transition-colors ${modo === 'completo' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              >
                Completo
              </button>
              <button
                onClick={() => alterarModo('nome')}
                className={`px-3 py-1.5 transition-colors border-l border-gray-200 ${modo === 'nome' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              >
                Somente Nome
              </button>
            </div>
            <button className="btn-primary" onClick={abrirNovo}>+ Novo Cliente</button>
          </div>
        </div>

        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Nome</th>
                  {modo === 'completo' && <>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">CPF</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 hidden lg:table-cell">RG</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">Telefone</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 hidden lg:table-cell">Email</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">Nascimento</th>
                  </>}
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {clientes.length === 0 && (
                  <tr><td colSpan={8} className="text-center py-12 text-gray-400">Nenhum cliente cadastrado.</td></tr>
                )}
                {clientes.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">{c.nome}</td>
                    {modo === 'completo' && <>
                      <td className="px-4 py-3 text-gray-500 hidden md:table-cell">{c.cpf || '—'}</td>
                      <td className="px-4 py-3 text-gray-500 hidden lg:table-cell">{c.rg || '—'}</td>
                      <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">{c.telefone || '—'}</td>
                      <td className="px-4 py-3 text-gray-500 hidden lg:table-cell">{c.email || '—'}</td>
                      <td className="px-4 py-3 text-gray-500 hidden md:table-cell">
                        {c.data_nascimento ? new Date(c.data_nascimento + 'T12:00').toLocaleDateString('pt-BR') : '—'}
                      </td>
                    </>}
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button className="btn-secondary text-xs" onClick={() => abrirEditar(c)}>Editar</button>
                        <button className="btn-danger text-xs" onClick={() => setDeletando(c)}>Excluir</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <p className="text-xs text-gray-400">{clientes.length} cliente(s) encontrado(s)</p>
      </div>

      {/* Modal Formulário */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-lg font-semibold mb-4">{editando ? 'Editar Cliente' : 'Novo Cliente'}</h2>
              {erro && <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{erro}</div>}
              <form onSubmit={salvar} className="space-y-3">
                <div>
                  <label className="label">Nome completo *</label>
                  <input className="input" value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">CPF</label>
                    <input className="input" placeholder="000.000.000-00" value={form.cpf} onChange={e => setForm({ ...form, cpf: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">RG</label>
                    <input className="input" value={form.rg} onChange={e => setForm({ ...form, rg: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Telefone</label>
                    <input className="input" placeholder="(11) 99999-9999" value={form.telefone} onChange={e => setForm({ ...form, telefone: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">Data de Nascimento</label>
                    <input type="date" className="input" value={form.data_nascimento} onChange={e => setForm({ ...form, data_nascimento: e.target.value })} />
                  </div>
                </div>
                <div>
                  <label className="label">Email</label>
                  <input type="email" className="input" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                </div>
                <div>
                  <label className="label">Observações</label>
                  <textarea className="input resize-none" rows={2} value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} />
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

      {/* Confirm Deletar */}
      {deletando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-lg font-semibold mb-2">Excluir Cliente</h2>
            <p className="text-sm text-gray-600 mb-4">Deseja excluir <strong>{deletando.nome}</strong>?</p>
            {erro && <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{erro}</div>}
            <div className="flex gap-3 justify-end">
              <button className="btn-secondary" onClick={() => { setDeletando(null); setErro('') }}>Cancelar</button>
              <button className="btn-danger" onClick={deletar} disabled={loading}>{loading ? 'Removendo...' : 'Excluir'}</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
