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
  valor_compartilhado: number
  valor_casal: number
  descricao: string
  oculto: number
}

const empty: Omit<Viagem, 'id' | 'oculto'> = { nome: '', destino: '', data_saida: '', data_retorno: '', valor: 0, valor_compartilhado: 0, valor_casal: 0, descricao: '' }

function chavesMes(viagens: Viagem[]) {
  const meses = new Map<string, Viagem[]>()
  const ordenadas = [...viagens].sort((a, b) => a.data_saida.localeCompare(b.data_saida))
  for (const v of ordenadas) {
    const [ano, mes] = v.data_saida.split('-')
    const chave = `${ano}-${mes}`
    if (!meses.has(chave)) meses.set(chave, [])
    meses.get(chave)!.push(v)
  }
  return meses
}

function nomeMes(chave: string) {
  const [ano, mes] = chave.split('-')
  return new Date(Number(ano), Number(mes) - 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}

function CardViagem({ v, isAdmin, ocultandoId, onVer, onEditar, onOcultar, onDeletar }: {
  v: Viagem; isAdmin: boolean; ocultandoId: number | null
  onVer: () => void; onEditar: () => void; onOcultar: () => void; onDeletar: () => void
}) {
  return (
    <div className="card hover:shadow-md transition-shadow">
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
        <span>Saída: {new Date(v.data_saida + 'T12:00').toLocaleDateString('pt-BR')}</span>
        <span>Retorno: {new Date(v.data_retorno + 'T12:00').toLocaleDateString('pt-BR')}</span>
      </div>
      {v.descricao && <p className="text-xs text-gray-500 mb-3 line-clamp-2">{v.descricao}</p>}
      <div className="flex gap-2 pt-3 border-t border-gray-100">
        <button className="btn-secondary text-xs flex-1" onClick={onVer}>Ver detalhes</button>
        {isAdmin && (
          <>
            <button className="btn-secondary text-xs flex-1" onClick={onEditar}>Editar</button>
            <button
              className="text-xs flex-1 px-3 py-1.5 rounded-lg bg-yellow-50 text-yellow-700 border border-yellow-200 hover:bg-yellow-100 transition-colors disabled:opacity-50"
              onClick={onOcultar} disabled={ocultandoId === v.id}
            >
              {ocultandoId === v.id ? '...' : 'Ocultar'}
            </button>
            <button className="btn-danger text-xs flex-1" onClick={onDeletar}>Excluir</button>
          </>
        )}
      </div>
    </div>
  )
}

export default function Viagens() {
  const [viagens, setViagens] = useState<Viagem[]>([])
  const [form, setForm] = useState<Omit<Viagem, 'id' | 'oculto'>>(empty)
  const [editando, setEditando] = useState<Viagem | null>(null)
  const [deletando, setDeletando] = useState<Viagem | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [visualizando, setVisualizando] = useState<Viagem | null>(null)
  const [ocultandoId, setOcultandoId] = useState<number | null>(null)
  const [mesesAbertos, setMesesAbertos] = useState<Set<string>>(new Set())
  const [toast, setToast] = useState('')
  const [erro, setErro] = useState('')
  const { isAdmin } = useAuth()

  useEffect(() => { carregar() }, [])

  function carregar() {
    api.get('/viagens').then((r) => {
      setViagens(r.data)
      // Abrir todos os meses por padrão
      const meses = chavesMes(r.data.filter((v: Viagem) => !v.oculto))
      setMesesAbertos(new Set(meses.keys()))
    })
  }

  function toggleMes(chave: string) {
    setMesesAbertos(prev => {
      const next = new Set(prev)
      next.has(chave) ? next.delete(chave) : next.add(chave)
      return next
    })
  }

  function mostrarToast(msg: string) {
    setToast(msg); setTimeout(() => setToast(''), 3000)
  }

  function abrirNovo() {
    setForm(empty); setEditando(null); setErro(''); setShowForm(true)
  }

  function abrirEditar(v: Viagem) {
    setForm({ nome: v.nome, destino: v.destino, data_saida: v.data_saida, data_retorno: v.data_retorno, valor: v.valor, valor_compartilhado: v.valor_compartilhado || v.valor || 0, valor_casal: v.valor_casal || 0, descricao: v.descricao })
    setEditando(v); setErro(''); setShowForm(true)
  }

  async function toggleOculto(v: Viagem) {
    setOcultandoId(v.id)
    try {
      const r = await api.patch(`/viagens/${v.id}/oculto`, {})
      mostrarToast(r.data.mensagem); carregar()
    } catch { mostrarToast('Erro ao atualizar viagem') }
    finally { setOcultandoId(null) }
  }

  async function salvar(e: FormEvent) {
    e.preventDefault(); setLoading(true); setErro('')
    try {
      if (editando) await api.put(`/viagens/${editando.id}`, form)
      else await api.post('/viagens', form)
      setShowForm(false); carregar()
    } catch (err: any) { setErro(err.response?.data?.erro || 'Erro ao salvar') }
    finally { setLoading(false) }
  }

  async function deletar() {
    if (!deletando) return
    setLoading(true)
    try {
      await api.delete(`/viagens/${deletando.id}`)
      setDeletando(null); carregar()
    } finally { setLoading(false) }
  }

  const visiveis = viagens.filter(v => !v.oculto)
  const ocultas = viagens.filter(v => v.oculto)
  const porMes = chavesMes(visiveis)

  return (
    <Layout titulo="Viagens">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-blue-600 text-white px-5 py-3 rounded-xl shadow-lg text-sm font-medium animate-pulse">
          {toast}
        </div>
      )}

      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <p className="text-sm text-gray-500">
            {visiveis.length} viagem(ns) visível(is){isAdmin && ocultas.length > 0 && ` · ${ocultas.length} oculta(s)`}
          </p>
          {isAdmin && (
            <button className="btn-primary" onClick={abrirNovo}>+ Nova Viagem</button>
          )}
        </div>

        {visiveis.length === 0 && (
          <div className="text-center py-12 text-gray-400">Nenhuma viagem cadastrada.</div>
        )}

        {/* Viagens agrupadas por mês */}
        {Array.from(porMes.entries()).map(([chave, lista]) => {
          const aberto = mesesAbertos.has(chave)
          return (
            <div key={chave}>
              {/* Cabeçalho do mês — clicável */}
              <button
                onClick={() => toggleMes(chave)}
                className="w-full flex items-center justify-between mb-3 group"
              >
                <div className="flex items-center gap-3">
                  <h2 className="text-base font-bold text-gray-700 capitalize">{nomeMes(chave)}</h2>
                  <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-medium">
                    {lista.length} viagem{lista.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <span className={`text-gray-400 text-sm transition-transform duration-200 ${aberto ? 'rotate-180' : ''}`}>▼</span>
              </button>

              {/* Cards do mês */}
              {aberto && (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-2">
                  {lista.map(v => (
                    <CardViagem
                      key={v.id} v={v} isAdmin={isAdmin} ocultandoId={ocultandoId}
                      onVer={() => setVisualizando(v)}
                      onEditar={() => abrirEditar(v)}
                      onOcultar={() => toggleOculto(v)}
                      onDeletar={() => setDeletando(v)}
                    />
                  ))}
                </div>
              )}

              <div className="border-b border-gray-100 mt-2" />
            </div>
          )
        })}

        {/* Viagens ocultas — apenas admin */}
        {isAdmin && ocultas.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Viagens Ocultas</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {ocultas.map((v) => (
                <div key={v.id} className="card border-dashed border-gray-300 opacity-70 hover:opacity-100 transition-opacity">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full">Oculta</span>
                      </div>
                      <h3 className="font-semibold text-gray-500">{v.nome}</h3>
                      <p className="text-sm text-gray-400">{v.destino}</p>
                    </div>
                    <span className="text-lg font-bold text-gray-400">
                      R$ {Number(v.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex gap-4 text-xs text-gray-400 mb-3">
                    <span>Saída: {new Date(v.data_saida + 'T12:00').toLocaleDateString('pt-BR')}</span>
                    <span>Retorno: {new Date(v.data_retorno + 'T12:00').toLocaleDateString('pt-BR')}</span>
                  </div>
                  <div className="flex gap-2 pt-3 border-t border-gray-100">
                    <button
                      className="text-xs flex-1 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors disabled:opacity-50"
                      onClick={() => toggleOculto(v)} disabled={ocultandoId === v.id}
                    >
                      {ocultandoId === v.id ? '...' : 'Reativar'}
                    </button>
                    <button className="btn-danger text-xs flex-1" onClick={() => setDeletando(v)}>Excluir</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modal visualização */}
      {visualizando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setVisualizando(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-start justify-between mb-5">
                <div>
                  <h2 className="text-lg font-semibold text-gray-800">{visualizando.nome}</h2>
                  <p className="text-sm text-gray-500">{visualizando.destino}</p>
                </div>
                <button onClick={() => setVisualizando(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between py-2 border-b border-gray-50">
                  <span className="text-gray-500">Data de Saída</span>
                  <span className="font-medium">{new Date(visualizando.data_saida + 'T12:00').toLocaleDateString('pt-BR')}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-50">
                  <span className="text-gray-500">Data de Retorno</span>
                  <span className="font-medium">{new Date(visualizando.data_retorno + 'T12:00').toLocaleDateString('pt-BR')}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-50">
                  <span className="text-gray-500">Valor</span>
                  <span className="font-bold text-emerald-600 text-base">R$ {Number(visualizando.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
                {visualizando.descricao && (
                  <div className="py-2">
                    <p className="text-gray-500 mb-1">Descrição</p>
                    <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{visualizando.descricao}</p>
                  </div>
                )}
              </div>
              <div className="mt-5 flex justify-end">
                <button className="btn-secondary" onClick={() => setVisualizando(null)}>Fechar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal formulário */}
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
                    <label className="label">Data de Saída</label>
                    <input type="date" className="input" value={form.data_saida} onChange={(e) => setForm({ ...form, data_saida: e.target.value })} required />
                  </div>
                  <div>
                    <label className="label">Data de Retorno</label>
                    <input type="date" className="input" value={form.data_retorno} onChange={(e) => setForm({ ...form, data_retorno: e.target.value })} required />
                  </div>
                  <div>
                    <label className="label">Valor - Quarto Compartilhado (R$)</label>
                    <input type="number" step="0.01" min="0" className="input" value={form.valor_compartilhado} onChange={(e) => setForm({ ...form, valor_compartilhado: Number(e.target.value), valor: Number(e.target.value) })} required />
                  </div>
                  <div>
                    <label className="label">Valor - Quarto Casal (R$)</label>
                    <input type="number" step="0.01" min="0" className="input" value={form.valor_casal} onChange={(e) => setForm({ ...form, valor_casal: Number(e.target.value) })} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="label">Descrição</label>
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
          message={`Deseja excluir a viagem "${deletando.nome}"? Esta ação não pode ser desfeita.`}
          onClose={() => setDeletando(null)}
          onConfirm={deletar}
          confirmLabel="Excluir"
          loading={loading}
        />
      )}
    </Layout>
  )
}
