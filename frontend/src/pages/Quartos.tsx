import { useEffect, useState, FormEvent } from 'react'
import Layout from '../components/Layout'
import api from '../services/api'

interface Viagem {
  id: number
  nome: string
  destino: string
  data_saida: string
}

interface Pessoa {
  id: number
  quarto_id: number
  nome_pessoa: string
}

interface Quarto {
  id: number
  viagem_id: number
  nome: string
  capacidade: number | null
  pessoas: Pessoa[]
}

const fmtData = (s: string) => s ? new Date(s + 'T12:00').toLocaleDateString('pt-BR') : ''

export default function Quartos() {
  const [viagens, setViagens] = useState<Viagem[]>([])
  const [viagemId, setViagemId] = useState('')
  const [quartos, setQuartos] = useState<Quarto[]>([])
  const [showFormQuarto, setShowFormQuarto] = useState(false)
  const [formQuarto, setFormQuarto] = useState({ nome: '', capacidade: '' })
  const [editandoQuarto, setEditandoQuarto] = useState<Quarto | null>(null)
  const [adicionandoPessoa, setAdicionandoPessoa] = useState<number | null>(null) // quarto_id
  const [nomePessoa, setNomePessoa] = useState('')
  const [toast, setToast] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    api.get('/viagens').then(r => setViagens(r.data))
  }, [])

  useEffect(() => {
    if (!viagemId) { setQuartos([]); return }
    carregarQuartos()
  }, [viagemId])

  function carregarQuartos() {
    api.get('/quartos', { params: { viagem_id: viagemId } }).then(r => setQuartos(r.data))
  }

  function mostrarToast(msg: string) {
    setToast(msg); setTimeout(() => setToast(''), 3000)
  }

  function abrirFormQuarto(q?: Quarto) {
    setEditandoQuarto(q || null)
    setFormQuarto({ nome: q?.nome || '', capacidade: q?.capacidade?.toString() || '' })
    setShowFormQuarto(true)
  }

  async function salvarQuarto(e: FormEvent) {
    e.preventDefault(); setLoading(true)
    try {
      const payload = { viagem_id: Number(viagemId), nome: formQuarto.nome, capacidade: formQuarto.capacidade ? Number(formQuarto.capacidade) : null }
      if (editandoQuarto) {
        await api.put(`/quartos/${editandoQuarto.id}`, payload)
        mostrarToast('Quarto atualizado!')
      } else {
        await api.post('/quartos', payload)
        mostrarToast('Quarto criado!')
      }
      setShowFormQuarto(false); carregarQuartos()
    } catch (err: any) {
      mostrarToast(err.response?.data?.erro || 'Erro ao salvar')
    } finally { setLoading(false) }
  }

  async function excluirQuarto(id: number) {
    if (!confirm('Excluir este quarto e todas as pessoas dentro?')) return
    await api.delete(`/quartos/${id}`)
    mostrarToast('Quarto removido')
    carregarQuartos()
  }

  async function adicionarPessoa(quartoId: number) {
    if (!nomePessoa.trim()) return
    setLoading(true)
    try {
      const r = await api.post(`/quartos/${quartoId}/pessoas`, { nome_pessoa: nomePessoa.trim() })
      setQuartos(prev => prev.map(q =>
        q.id === quartoId ? { ...q, pessoas: [...q.pessoas, r.data] } : q
      ))
      setNomePessoa(''); setAdicionandoPessoa(null)
      mostrarToast('Pessoa adicionada!')
    } catch (err: any) {
      mostrarToast(err.response?.data?.erro || 'Erro ao adicionar')
    } finally { setLoading(false) }
  }

  async function removerPessoa(pessoaId: number, quartoId: number) {
    await api.delete(`/quartos/pessoas/${pessoaId}`)
    setQuartos(prev => prev.map(q =>
      q.id === quartoId ? { ...q, pessoas: q.pessoas.filter(p => p.id !== pessoaId) } : q
    ))
    mostrarToast('Pessoa removida')
  }

  const viagemSelecionada = viagens.find(v => v.id === Number(viagemId))

  return (
    <Layout titulo="Quartos">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-blue-600 text-white px-5 py-3 rounded-xl shadow-lg text-sm font-medium">
          {toast}
        </div>
      )}

      <div className="space-y-6">

        {/* Seletor de viagem */}
        <div className="card p-4">
          <label className="label mb-1">Selecione a viagem</label>
          <select className="input max-w-lg" value={viagemId} onChange={e => setViagemId(e.target.value)}>
            <option value="">Escolha uma viagem...</option>
            {viagens.map(v => (
              <option key={v.id} value={v.id}>
                {v.nome} — {v.destino}{v.data_saida ? ` · ${fmtData(v.data_saida)}` : ''}
              </option>
            ))}
          </select>
          {viagemSelecionada && (
            <p className="text-xs text-gray-400 mt-1">{quartos.length} quarto(s) cadastrado(s)</p>
          )}
        </div>

        {/* Conteúdo */}
        {!viagemId ? (
          <div className="text-center py-16 text-gray-400">
            <div className="text-5xl mb-3">🛏️</div>
            <p className="text-sm">Selecione uma viagem para gerenciar os quartos</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-sm font-medium text-gray-600">{quartos.length} quarto(s)</h2>
              <button className="btn-primary text-sm" onClick={() => abrirFormQuarto()}>+ Adicionar Quarto</button>
            </div>

            {quartos.length === 0 && (
              <div className="text-center py-12 text-gray-400">
                <div className="text-4xl mb-2">🛏️</div>
                <p className="text-sm">Nenhum quarto cadastrado para esta viagem.</p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {quartos.map(q => (
                <div key={q.id} className="card flex flex-col">
                  {/* Cabeçalho do quarto */}
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-gray-800">{q.nome}</h3>
                      {q.capacidade && (
                        <p className="text-xs text-gray-400">Capacidade: {q.capacidade} pessoa(s)</p>
                      )}
                      <p className="text-xs text-gray-400">{q.pessoas.length} pessoa(s) no quarto</p>
                    </div>
                    <div className="flex gap-1">
                      <button className="btn-secondary text-xs px-2 py-1" onClick={() => abrirFormQuarto(q)}>✏️</button>
                      <button className="btn-danger text-xs px-2 py-1" onClick={() => excluirQuarto(q.id)}>🗑️</button>
                    </div>
                  </div>

                  {/* Lista de pessoas */}
                  <div className="flex-1 space-y-1 mb-3 min-h-[40px]">
                    {q.pessoas.length === 0 && (
                      <p className="text-xs text-gray-400 italic">Nenhuma pessoa adicionada</p>
                    )}
                    {q.pessoas.map(p => (
                      <div key={p.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-1.5">
                        <span className="text-sm text-gray-700">👤 {p.nome_pessoa}</span>
                        <button
                          onClick={() => removerPessoa(p.id, q.id)}
                          className="text-red-400 hover:text-red-600 text-xs ml-2"
                        >✕</button>
                      </div>
                    ))}
                  </div>

                  {/* Adicionar pessoa */}
                  {adicionandoPessoa === q.id ? (
                    <div className="flex gap-2">
                      <input
                        className="input text-sm flex-1"
                        placeholder="Nome da pessoa"
                        value={nomePessoa}
                        onChange={e => setNomePessoa(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') adicionarPessoa(q.id) }}
                        autoFocus
                      />
                      <button
                        className="btn-primary text-xs px-3"
                        onClick={() => adicionarPessoa(q.id)}
                        disabled={loading || !nomePessoa.trim()}
                      >OK</button>
                      <button
                        className="btn-secondary text-xs px-2"
                        onClick={() => { setAdicionandoPessoa(null); setNomePessoa('') }}
                      >✕</button>
                    </div>
                  ) : (
                    <button
                      className="w-full text-xs py-1.5 border border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors"
                      onClick={() => { setAdicionandoPessoa(q.id); setNomePessoa('') }}
                    >
                      + Adicionar pessoa
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modal quarto */}
      {showFormQuarto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
            <div className="p-6">
              <h2 className="text-lg font-semibold mb-4">{editandoQuarto ? 'Editar Quarto' : 'Novo Quarto'}</h2>
              <form onSubmit={salvarQuarto} className="space-y-3">
                <div>
                  <label className="label">Nome do Quarto *</label>
                  <input className="input" placeholder="Ex: Quarto 1, Quarto Casal, Suíte 101"
                    value={formQuarto.nome} onChange={e => setFormQuarto({ ...formQuarto, nome: e.target.value })} required />
                </div>
                <div>
                  <label className="label">Capacidade (opcional)</label>
                  <input type="number" min={1} className="input" placeholder="Ex: 4"
                    value={formQuarto.capacidade} onChange={e => setFormQuarto({ ...formQuarto, capacidade: e.target.value })} />
                </div>
                <div className="flex gap-3 justify-end pt-2">
                  <button type="button" className="btn-secondary" onClick={() => setShowFormQuarto(false)} disabled={loading}>Cancelar</button>
                  <button type="submit" className="btn-primary" disabled={loading}>{loading ? 'Salvando...' : 'Salvar'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
