import { useEffect, useState, FormEvent } from 'react'
import Layout from '../components/Layout'
import Modal from '../components/Modal'
import api from '../services/api'
import { useAuth } from '../contexts/AuthContext'

interface Viagem {
  id: number
  nome: string
  destino: string
  data_saida: string
  data_retorno: string
  valor: number
  descricao: string
}

const empty: Omit<Viagem, 'id'> = { nome: '', destino: '', data_saida: '', data_retorno: '', valor: 0, descricao: '' }

export default function Viagens() {
  const [viagens, setViagens] = useState<Viagem[]>([])
  const [form, setForm] = useState<Omit<Viagem, 'id'>>(empty)
  const [editando, setEditando] = useState<Viagem | null>(null)
  const [deletando, setDeletando] = useState<Viagem | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const { isAdmin } = useAuth()

  useEffect(() => { carregar() }, [])

  function carregar() {
    api.get('/viagens').then((r) => setViagens(r.data))
  }

  function abrirNovo() {
    setForm(empty)
    setEditando(null)
    setErro('')
    setShowForm(true)
  }

  function abrirEditar(v: Viagem) {
    setForm({ nome: v.nome, destino: v.destino, data_saida: v.data_saida, data_retorno: v.data_retorno, valor: v.valor, descricao: v.descricao })
    setEditando(v)
    setErro('')
    setShowForm(true)
  }

  async function salvar(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setErro('')
    try {
      if (editando) {
        await api.put(`/viagens/${editando.id}`, form)
      } else {
        await api.post('/viagens', form)
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
      await api.delete(`/viagens/${deletando.id}`)
      setDeletando(null)
      carregar()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Layout titulo="Viagens">
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <p className="text-sm text-gray-500">{viagens.length} viagem(ns) cadastrada(s)</p>
          {isAdmin && (
            <button className="btn-primary" onClick={abrirNovo}>+ Nova Viagem</button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {viagens.length === 0 && (
            <div className="col-span-full text-center py-12 text-gray-400">Nenhuma viagem cadastrada.</div>
          )}
          {viagens.map((v) => (
            <div key={v.id} className="card hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-semibold text-gray-800">{v.nome}</h3>
                  <p className="text-sm text-gray-500">{v.destino}</p>
                </div>
                <span className="text-lg font-bold text-emerald-600">
                  R$ {Number(v.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex gap-4 text-xs text-gray-500 mb-3">
                <span>Saida: {new Date(v.data_saida + 'T12:00').toLocaleDateString('pt-BR')}</span>
                <span>Retorno: {new Date(v.data_retorno + 'T12:00').toLocaleDateString('pt-BR')}</span>
              </div>
              {v.descricao && <p className="text-xs text-gray-500 mb-3 line-clamp-2">{v.descricao}</p>}
              {isAdmin && (
                <div className="flex gap-2 pt-3 border-t border-gray-100">
                  <button className="btn-secondary text-xs flex-1" onClick={() => abrirEditar(v)}>Editar</button>
                  <button className="btn-danger text-xs flex-1" onClick={() => setDeletando(v)}>Excluir</button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-lg font-semibold mb-4">{editando ? 'Editar Viagem' : 'Nova Viagem'}</h2>
              {erro && <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{erro}</div>}
              <form onSubmit={salvar} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="label">Nome da Viagem</label>
                    <input className="input" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="label">Destino</label>
                    <input className="input" value={form.destino} onChange={(e) => setForm({ ...form, destino: e.target.value })} required />
                  </div>
                  <div>
                    <label className="label">Data de Saida</label>
                    <input type="date" className="input" value={form.data_saida} onChange={(e) => setForm({ ...form, data_saida: e.target.value })} required />
                  </div>
                  <div>
                    <label className="label">Data de Retorno</label>
                    <input type="date" className="input" value={form.data_retorno} onChange={(e) => setForm({ ...form, data_retorno: e.target.value })} required />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="label">Valor (R$)</label>
                    <input type="number" step="0.01" min="0" className="input" value={form.valor} onChange={(e) => setForm({ ...form, valor: Number(e.target.value) })} required />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="label">Descricao</label>
                    <textarea className="input resize-none" rows={3} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
                  </div>
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
          title="Excluir Viagem"
          message={`Deseja excluir a viagem "${deletando.nome}"? Esta acao nao pode ser desfeita.`}
          onClose={() => setDeletando(null)}
          onConfirm={deletar}
          confirmLabel="Excluir"
          loading={loading}
        />
      )}
    </Layout>
  )
}
