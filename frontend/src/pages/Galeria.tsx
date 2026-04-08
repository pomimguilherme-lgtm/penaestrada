import { useEffect, useRef, useState } from 'react'
import Layout from '../components/Layout'
import api from '../services/api'
import { useAuth } from '../contexts/AuthContext'

interface Viagem {
  id: number
  nome: string
  destino: string
  data_saida: string
}

interface Midia {
  id: number
  viagem_id: number
  tipo: 'imagem' | 'video'
  nome_arquivo: string
  url: string
  tamanho: number
  uploaded_por_nome: string
  created_at: string
}

const BACKEND_URL = (import.meta.env.VITE_API_URL || '').replace('/api', '')

function fmtData(s: string) {
  return s ? new Date(s + 'T12:00').toLocaleDateString('pt-BR') : ''
}

function fmtTamanho(bytes: number) {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function Galeria() {
  const [viagens, setViagens] = useState<Viagem[]>([])
  const [viagem, setViagem] = useState<Viagem | null>(null)
  const [midias, setMidias] = useState<Midia[]>([])
  const [modal, setModal] = useState<Midia | null>(null)
  const [uploading, setUploading] = useState(false)
  const [progresso, setProgresso] = useState(0)
  const [toast, setToast] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const { isAdmin } = useAuth()

  useEffect(() => {
    api.get('/viagens').then(r => setViagens(r.data))
  }, [])

  function mostrarToast(msg: string) {
    setToast(msg); setTimeout(() => setToast(''), 3500)
  }

  function abrirViagem(v: Viagem) {
    setViagem(v); carregarMidias(v.id)
  }

  function carregarMidias(vid: number) {
    api.get(`/galeria/${vid}`).then(r => setMidias(r.data))
  }

  async function uploadArquivos(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || !files.length || !viagem) return
    setUploading(true); setProgresso(0)

    const formData = new FormData()
    Array.from(files).forEach(f => formData.append('midias', f))

    try {
      await api.post(`/galeria/${viagem.id}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (ev) => {
          if (ev.total) setProgresso(Math.round((ev.loaded / ev.total) * 100))
        },
      })
      carregarMidias(viagem.id)
      mostrarToast(`${files.length} arquivo(s) enviado(s) com sucesso!`)
    } catch (err: any) {
      mostrarToast(err.response?.data?.erro || 'Erro ao enviar arquivos')
    } finally {
      setUploading(false); setProgresso(0)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function excluir(midia: Midia) {
    if (!confirm(`Excluir esta ${midia.tipo}?`)) return
    try {
      await api.delete(`/galeria/${midia.id}`)
      setMidias(prev => prev.filter(m => m.id !== midia.id))
      if (modal?.id === midia.id) setModal(null)
      mostrarToast('Mídia removida')
    } catch (err: any) {
      mostrarToast(err.response?.data?.erro || 'Erro ao excluir')
    }
  }

  function baixar(midia: Midia) {
    const a = document.createElement('a')
    a.href = midia.url
    a.download = midia.nome_arquivo
    a.target = '_blank'
    a.click()
  }

  // ─── Tela 1: lista de viagens ────────────────────────────────────────────
  if (!viagem) {
    return (
      <Layout titulo="Galeria de Viagens">
        {toast && <Toast msg={toast} />}
        <div className="space-y-4">
          <p className="text-sm text-gray-500">Selecione uma viagem para ver ou adicionar fotos e vídeos.</p>
          {viagens.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <div className="text-5xl mb-3">🖼️</div>
              <p>Nenhuma viagem cadastrada.</p>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {viagens.map(v => (
              <div key={v.id} className="card hover:shadow-md transition-shadow">
                <div className="text-3xl mb-3">✈️</div>
                <h3 className="font-semibold text-gray-800">{v.nome}</h3>
                <p className="text-sm text-gray-500 mb-1">{v.destino}</p>
                {v.data_saida && <p className="text-xs text-gray-400 mb-4">Saída: {fmtData(v.data_saida)}</p>}
                <button className="btn-primary w-full text-sm" onClick={() => abrirViagem(v)}>
                  🖼️ Ver Galeria
                </button>
              </div>
            ))}
          </div>
        </div>
      </Layout>
    )
  }

  // ─── Tela 2: galeria da viagem ───────────────────────────────────────────
  return (
    <Layout titulo={`Galeria — ${viagem.nome}`}>
      {toast && <Toast msg={toast} />}

      <div className="space-y-5">
        {/* Cabeçalho */}
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <button className="btn-secondary text-sm flex items-center gap-1" onClick={() => setViagem(null)}>
            ← Voltar
          </button>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">{midias.length} mídia(s)</span>
            {isAdmin && (
              <>
                <input
                  ref={inputRef}
                  type="file"
                  multiple
                  accept="image/*,video/mp4,video/quicktime"
                  className="hidden"
                  onChange={uploadArquivos}
                />
                <button
                  className="btn-primary text-sm"
                  onClick={() => inputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? `Enviando ${progresso}%...` : '+ Adicionar mídia'}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Barra de progresso */}
        {uploading && (
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progresso}%` }}
            />
          </div>
        )}

        {/* Grid de mídias */}
        {midias.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <div className="text-5xl mb-3">📷</div>
            <p className="text-sm">Nenhuma mídia adicionada ainda.</p>
            {isAdmin && (
              <button className="btn-primary mt-4 text-sm" onClick={() => inputRef.current?.click()}>
                + Adicionar primeira mídia
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
            {midias.map(m => (
              <div
                key={m.id}
                className="relative group aspect-square bg-gray-100 rounded-lg overflow-hidden cursor-pointer"
                onClick={() => setModal(m)}
              >
                {m.tipo === 'imagem' ? (
                  <img
                    src={m.url}
                    alt=""
                    className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                    loading="lazy"
                  />
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

                {/* Overlay com ações */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-200 flex items-end justify-end p-1.5 gap-1 opacity-0 group-hover:opacity-100">
                  <button
                    onClick={e => { e.stopPropagation(); baixar(m) }}
                    className="w-7 h-7 bg-white/90 rounded-full flex items-center justify-center text-gray-700 hover:bg-white text-xs"
                    title="Baixar"
                  >⬇</button>
                  {isAdmin && (
                    <button
                      onClick={e => { e.stopPropagation(); excluir(m) }}
                      className="w-7 h-7 bg-red-500/90 rounded-full flex items-center justify-center text-white hover:bg-red-600 text-xs"
                      title="Excluir"
                    >✕</button>
                  )}
                </div>

                {/* Badge tipo */}
                {m.tipo === 'video' && (
                  <div className="absolute top-1 left-1 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded">
                    MP4
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de visualização */}
      {modal && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setModal(null)}
        >
          <div className="relative max-w-5xl w-full max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>

            {/* Barra superior */}
            <div className="flex items-center justify-between mb-3 text-white/80 text-sm">
              <span>{fmtTamanho(modal.tamanho)}{modal.uploaded_por_nome ? ` · ${modal.uploaded_por_nome}` : ''}</span>
              <div className="flex gap-2">
                <button
                  onClick={() => baixar(modal)}
                  className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-xs"
                >⬇ Baixar</button>
                {isAdmin && (
                  <button
                    onClick={() => excluir(modal)}
                    className="px-3 py-1 bg-red-500/70 hover:bg-red-500 rounded-lg text-xs"
                  >✕ Excluir</button>
                )}
                <button
                  onClick={() => setModal(null)}
                  className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-xs"
                >✕ Fechar</button>
              </div>
            </div>

            {/* Mídia */}
            {modal.tipo === 'imagem' ? (
              <img
                src={modal.url}
                alt=""
                className="max-h-[80vh] w-full object-contain rounded-lg"
              />
            ) : (
              <video
                src={modal.url}
                controls
                autoPlay
                className="max-h-[80vh] w-full rounded-lg bg-black"
              />
            )}

            {/* Navegação */}
            <div className="flex justify-between mt-3">
              <button
                className="text-white/60 hover:text-white text-2xl px-3"
                onClick={() => {
                  const idx = midias.findIndex(m => m.id === modal.id)
                  if (idx > 0) setModal(midias[idx - 1])
                }}
              >‹</button>
              <span className="text-white/40 text-xs self-center">
                {midias.findIndex(m => m.id === modal.id) + 1} / {midias.length}
              </span>
              <button
                className="text-white/60 hover:text-white text-2xl px-3"
                onClick={() => {
                  const idx = midias.findIndex(m => m.id === modal.id)
                  if (idx < midias.length - 1) setModal(midias[idx + 1])
                }}
              >›</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}

function Toast({ msg }: { msg: string }) {
  return (
    <div className="fixed top-4 right-4 z-50 bg-blue-600 text-white px-5 py-3 rounded-xl shadow-lg text-sm font-medium">
      {msg}
    </div>
  )
}
