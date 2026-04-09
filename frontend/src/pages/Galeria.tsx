import { useEffect, useRef, useState, FormEvent } from 'react'
import Layout from '../components/Layout'
import api from '../services/api'
import { useAuth } from '../contexts/AuthContext'

interface Galeria {
  id: number
  nome: string
  data: string | null
  descricao: string | null
  criado_por_nome: string
  total_midias: number
  created_at: string
}

interface Midia {
  id: number
  galeria_id: number
  tipo: 'imagem' | 'video'
  nome_arquivo: string
  url: string
  tamanho: number
  uploaded_por_nome: string
  created_at: string
}

const emptyForm = { nome: '', data: '', descricao: '' }

function fmtData(s: string | null) {
  if (!s) return ''
  return new Date(s + 'T12:00').toLocaleDateString('pt-BR')
}

function fmtTamanho(bytes: number) {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function Toast({ msg }: { msg: string }) {
  return (
    <div className="fixed top-4 right-4 z-50 bg-blue-600 text-white px-5 py-3 rounded-xl shadow-lg text-sm font-medium">
      {msg}
    </div>
  )
}

export default function GaleriaPage() {
  const [galerias, setGalerias] = useState<Galeria[]>([])
  const [ordem, setOrdem] = useState<'asc' | 'desc'>('asc')
  const [galeriaAtual, setGaleriaAtual] = useState<Galeria | null>(null)
  const [midias, setMidias] = useState<Midia[]>([])
  const [modal, setModal] = useState<Midia | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editando, setEditando] = useState<Galeria | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [uploading, setUploading] = useState(false)
  const [progresso, setProgresso] = useState(0)
  const [toast, setToast] = useState('')
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const { isAdmin } = useAuth()

  useEffect(() => { carregarGalerias() }, [ordem])

  function mostrarToast(msg: string) {
    setToast(msg); setTimeout(() => setToast(''), 3500)
  }

  function carregarGalerias() {
    api.get(`/galerias?ordem=${ordem}`).then(r => setGalerias(r.data)).catch(() => {})
  }

  function carregarMidias(gid: number) {
    api.get(`/galerias/${gid}/midias`).then(r => setMidias(r.data)).catch(() => {})
  }

  function abrirGaleria(g: Galeria) {
    setGaleriaAtual(g); carregarMidias(g.id)
  }

  function abrirNova() {
    setForm(emptyForm); setEditando(null); setShowForm(true)
  }

  function abrirEditar(g: Galeria, e: React.MouseEvent) {
    e.stopPropagation()
    setForm({ nome: g.nome, data: g.data || '', descricao: g.descricao || '' })
    setEditando(g); setShowForm(true)
  }

  async function salvarGaleria(e: FormEvent) {
    e.preventDefault(); setLoading(true)
    try {
      if (editando) {
        await api.put(`/galerias/${editando.id}`, form)
        mostrarToast('Galeria atualizada!')
      } else {
        await api.post('/galerias', form)
        mostrarToast('Galeria criada!')
      }
      setShowForm(false); carregarGalerias()
    } catch (err: any) {
      mostrarToast(err.response?.data?.erro || 'Erro ao salvar')
    } finally { setLoading(false) }
  }

  async function excluirGaleria(g: Galeria, e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm(`Excluir a galeria "${g.nome}" e todas as suas mídias?`)) return
    try {
      await api.delete(`/galerias/${g.id}`)
      mostrarToast('Galeria removida')
      carregarGalerias()
    } catch (err: any) {
      mostrarToast(err.response?.data?.erro || 'Erro ao excluir')
    }
  }

  async function uploadArquivos(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files?.length || !galeriaAtual) return
    setUploading(true); setProgresso(0)
    const formData = new FormData()
    Array.from(files).forEach(f => formData.append('midias', f))
    try {
      await api.post(`/galerias/${galeriaAtual.id}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (ev) => {
          if (ev.total) setProgresso(Math.round((ev.loaded / ev.total) * 100))
        },
      })
      carregarMidias(galeriaAtual.id)
      carregarGalerias()
      mostrarToast(`${files.length} arquivo(s) enviado(s)!`)
    } catch (err: any) {
      mostrarToast(err.response?.data?.erro || 'Erro ao enviar')
    } finally {
      setUploading(false); setProgresso(0)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function excluirMidia(m: Midia) {
    if (!confirm('Excluir esta mídia?')) return
    try {
      await api.delete(`/galerias/midia/${m.id}`)
      setMidias(prev => prev.filter(x => x.id !== m.id))
      if (modal?.id === m.id) setModal(null)
      if (galeriaAtual) carregarGalerias()
      mostrarToast('Mídia removida')
    } catch (err: any) {
      mostrarToast(err.response?.data?.erro || 'Erro ao excluir')
    }
  }

  function baixar(m: Midia) {
    const a = document.createElement('a')
    a.href = m.url; a.download = m.nome_arquivo; a.target = '_blank'; a.click()
  }

  // ─── Tela 1: lista de galerias ────────────────────────────────────────────
  if (!galeriaAtual) {
    return (
      <Layout titulo="Galeria">
        {toast && <Toast msg={toast} />}
        <div className="space-y-5">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-500">{galerias.length} galeria(s)</p>
          <div className="flex items-center gap-3">
            {/* Botões A-Z / Z-A */}
            <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-medium">
              <button onClick={() => setOrdem('asc')}
                className={`px-3 py-1.5 transition-colors ${ordem === 'asc' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                A-Z
              </button>
              <button onClick={() => setOrdem('desc')}
                className={`px-3 py-1.5 transition-colors border-l border-gray-200 ${ordem === 'desc' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                Z-A
              </button>
            </div>
            {isAdmin && (
              <button className="btn-primary" onClick={abrirNova}>+ Criar Nova Galeria</button>
            )}
          </div>
          </div>

          {galerias.length === 0 && (
            <div className="text-center py-20 text-gray-400">
              <div className="text-5xl mb-3">🖼️</div>
              <p className="text-sm mb-4">Nenhuma galeria criada ainda.</p>
              {isAdmin && (
                <button className="btn-primary text-sm" onClick={abrirNova}>+ Criar primeira galeria</button>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {galerias.map(g => (
              <div key={g.id} className="card hover:shadow-md transition-shadow cursor-pointer" onClick={() => abrirGaleria(g)}>
                <div className="text-3xl mb-3">📸</div>
                <h3 className="font-semibold text-gray-800 mb-1">{g.nome}</h3>
                {g.data && <p className="text-xs text-gray-400 mb-1">📅 {fmtData(g.data)}</p>}
                {g.descricao && <p className="text-sm text-gray-500 mb-3 line-clamp-2">{g.descricao}</p>}
                <p className="text-xs text-gray-400 mb-4">{g.total_midias} mídia(s)</p>
                <div className="flex gap-2">
                  <button className="btn-primary text-xs flex-1" onClick={() => abrirGaleria(g)}>
                    Gerenciar mídia
                  </button>
                  {isAdmin && (
                    <>
                      <button className="btn-secondary text-xs px-3" onClick={(e) => abrirEditar(g, e)}>✏️</button>
                      <button className="btn-danger text-xs px-3" onClick={(e) => excluirGaleria(g, e)}>🗑️</button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Modal criar/editar galeria */}
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
              <div className="p-6">
                <h2 className="text-lg font-semibold mb-4">{editando ? 'Editar Galeria' : 'Nova Galeria'}</h2>
                <form onSubmit={salvarGaleria} className="space-y-3">
                  <div>
                    <label className="label">Nome da Galeria *</label>
                    <input className="input" placeholder="Ex: Arraial do Cabo 2025" value={form.nome}
                      onChange={e => setForm({ ...form, nome: e.target.value })} required />
                  </div>
                  <div>
                    <label className="label">Data ou Período (opcional)</label>
                    <input className="input" placeholder="Ex: 15/03/2025 ou Março 2025" value={form.data}
                      onChange={e => setForm({ ...form, data: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">Descrição (opcional)</label>
                    <textarea className="input resize-none" rows={3} placeholder="Descreva a galeria..."
                      value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} />
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
      </Layout>
    )
  }

  // ─── Tela 2: interior da galeria ──────────────────────────────────────────
  return (
    <Layout titulo={galeriaAtual.nome}>
      {toast && <Toast msg={toast} />}
      <div className="space-y-5">

        {/* Cabeçalho */}
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <button className="btn-secondary text-sm" onClick={() => setGaleriaAtual(null)}>← Voltar</button>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">{midias.length} mídia(s)</span>
            {isAdmin && (
              <>
                <input ref={inputRef} type="file" multiple accept="image/*,video/mp4,video/quicktime"
                  className="hidden" onChange={uploadArquivos} />
                <button className="btn-primary text-sm" onClick={() => inputRef.current?.click()} disabled={uploading}>
                  {uploading ? `Enviando ${progresso}%...` : '+ Adicionar mídia'}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Info da galeria */}
        {(galeriaAtual.data || galeriaAtual.descricao) && (
          <div className="bg-blue-50 rounded-xl px-4 py-3 text-sm text-blue-700 space-y-0.5">
            {galeriaAtual.data && <p>📅 {galeriaAtual.data}</p>}
            {galeriaAtual.descricao && <p>{galeriaAtual.descricao}</p>}
          </div>
        )}

        {/* Barra de progresso */}
        {uploading && (
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div className="bg-blue-600 h-2 rounded-full transition-all duration-300" style={{ width: `${progresso}%` }} />
          </div>
        )}

        {/* Grid */}
        {midias.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <div className="text-5xl mb-3">📷</div>
            <p className="text-sm">Nenhuma mídia ainda.</p>
            {isAdmin && (
              <button className="btn-primary mt-4 text-sm" onClick={() => inputRef.current?.click()}>
                + Adicionar primeira mídia
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
            {midias.map(m => (
              <div key={m.id} className="relative group aspect-square bg-gray-100 rounded-lg overflow-hidden cursor-pointer"
                onClick={() => setModal(m)}>
                {m.tipo === 'imagem' ? (
                  <img src={m.url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" loading="lazy" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-800">
                    <video src={m.url} className="w-full h-full object-cover" muted />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-12 h-12 bg-black/60 rounded-full flex items-center justify-center">
                        <span className="text-white text-xl ml-1">▶</span>
                      </div>
                    </div>
                  </div>
                )}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-200 flex items-end justify-end p-1.5 gap-1 opacity-0 group-hover:opacity-100">
                  <button onClick={e => { e.stopPropagation(); baixar(m) }}
                    className="w-7 h-7 bg-white/90 rounded-full flex items-center justify-center text-gray-700 hover:bg-white text-xs" title="Baixar">⬇</button>
                  {isAdmin && (
                    <button onClick={e => { e.stopPropagation(); excluirMidia(m) }}
                      className="w-7 h-7 bg-red-500/90 rounded-full flex items-center justify-center text-white hover:bg-red-600 text-xs" title="Excluir">✕</button>
                  )}
                </div>
                {m.tipo === 'video' && (
                  <div className="absolute top-1 left-1 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded">MP4</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal fullscreen */}
      {modal && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setModal(null)}>
          <div className="relative max-w-5xl w-full max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3 text-white/80 text-sm">
              <span>{fmtTamanho(modal.tamanho)}</span>
              <div className="flex gap-2">
                <button onClick={() => baixar(modal)} className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-xs">⬇ Baixar</button>
                {isAdmin && (
                  <button onClick={() => excluirMidia(modal)} className="px-3 py-1 bg-red-500/70 hover:bg-red-500 rounded-lg text-xs">✕ Excluir</button>
                )}
                <button onClick={() => setModal(null)} className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-xs">✕ Fechar</button>
              </div>
            </div>
            {modal.tipo === 'imagem' ? (
              <img src={modal.url} alt="" className="max-h-[80vh] w-full object-contain rounded-lg" />
            ) : (
              <video src={modal.url} controls autoPlay className="max-h-[80vh] w-full rounded-lg bg-black" />
            )}
            <div className="flex justify-between mt-3">
              <button className="text-white/60 hover:text-white text-2xl px-3" onClick={() => {
                const idx = midias.findIndex(m => m.id === modal.id)
                if (idx > 0) setModal(midias[idx - 1])
              }}>‹</button>
              <span className="text-white/40 text-xs self-center">{midias.findIndex(m => m.id === modal.id) + 1} / {midias.length}</span>
              <button className="text-white/60 hover:text-white text-2xl px-3" onClick={() => {
                const idx = midias.findIndex(m => m.id === modal.id)
                if (idx < midias.length - 1) setModal(midias[idx + 1])
              }}>›</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
