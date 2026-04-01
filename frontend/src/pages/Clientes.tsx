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
}

interface Parcela {
  id: number
  cliente_id: number
  numero_parcela: number
  data_vencimento: string
  pago: number
}

interface Cliente {
  id: number
  nome: string
  telefone: string
  cpf: string | null
  rg: string | null
  data_nascimento: string | null
  destino: string | null
  data_viagem: string | null
  viagem_id: number | null
  vendedor_id: number
  vendedor_nome: string
  viagem_nome: string | null
  viagem_valor: number | null
  desconto: number
  adicional: number
  observacoes: string | null
  forma_pagamento: string | null
  tipo_cartao: string | null
  num_parcelas: number
  data_primeira_parcela: string | null
}

const emptyForm = {
  nome: '', telefone: '', cpf: '', rg: '', data_nascimento: '',
  destino: '', data_viagem: '', viagem_id: '',
  desconto: '0', adicional: '0', observacoes: '',
  forma_pagamento: '', tipo_cartao: '', num_parcelas: '1', data_primeira_parcela: '',
}

function fmtMoeda(v: number) {
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtData(s: string) {
  return new Date(s + 'T12:00').toLocaleDateString('pt-BR')
}

function badgePagamento(c: Cliente) {
  if (!c.forma_pagamento) return null
  const map: Record<string, string> = { pix: 'bg-emerald-100 text-emerald-700', cartao: 'bg-blue-100 text-blue-700', boleto: 'bg-amber-100 text-amber-700' }
  const label: Record<string, string> = { pix: 'PIX', cartao: c.tipo_cartao === 'credito' ? `Crédito ${c.num_parcelas}x` : 'Débito', boleto: `Boleto ${c.num_parcelas}x` }
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${map[c.forma_pagamento] || 'bg-gray-100 text-gray-600'}`}>{label[c.forma_pagamento] || c.forma_pagamento}</span>
}

export default function Clientes() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [viagens, setViagens] = useState<Viagem[]>([])
  const [form, setForm] = useState(emptyForm)
  const [editando, setEditando] = useState<Cliente | null>(null)
  const [deletando, setDeletando] = useState<Cliente | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [busca, setBusca] = useState('')
  const [filtroViagem, setFiltroViagem] = useState('')
  const [parcelasVisiveis, setParcelasVisiveis] = useState<number | null>(null)
  const [parcelas, setParcelas] = useState<Parcela[]>([])
  const { isAdmin } = useAuth()

  // Preview parcelas no formulario
  const previewParcelas: string[] = (() => {
    const n = Number(form.num_parcelas) || 1
    const d = form.data_primeira_parcela
    if (!d || n <= 1) return []
    const result: string[] = []
    const base = new Date(d + 'T12:00:00')
    for (let i = 0; i < n; i++) {
      const dt = new Date(base)
      dt.setMonth(dt.getMonth() + i)
      result.push(dt.toISOString().split('T')[0])
    }
    return result
  })()

  useEffect(() => {
    api.get('/viagens').then((r) => setViagens(r.data))
    carregar()
  }, [])

  function carregar(b?: string, fv?: string) {
    const params = new URLSearchParams()
    const bVal = b !== undefined ? b : busca
    const fvVal = fv !== undefined ? fv : filtroViagem
    if (bVal) params.append('busca', bVal)
    if (fvVal) params.append('viagem_id', fvVal)
    api.get(`/clientes?${params}`).then((r) => setClientes(r.data))
  }

  function handleBusca(v: string) { setBusca(v); carregar(v, filtroViagem) }
  function handleFiltroViagem(v: string) { setFiltroViagem(v); carregar(busca, v) }

  function handleViagemSelect(viagemId: string) {
    const v = viagens.find((x) => String(x.id) === viagemId)
    if (v) setForm((f) => ({ ...f, viagem_id: viagemId, destino: v.destino, data_viagem: v.data_saida }))
    else setForm((f) => ({ ...f, viagem_id: '', destino: '', data_viagem: '' }))
  }

  function abrirNovo() {
    setForm(emptyForm); setEditando(null); setErro(''); setShowForm(true)
  }

  function abrirEditar(c: Cliente) {
    setForm({
      nome: c.nome, telefone: c.telefone, cpf: c.cpf || '', rg: c.rg || '',
      data_nascimento: c.data_nascimento || '', destino: c.destino || '',
      data_viagem: c.data_viagem || '', viagem_id: c.viagem_id ? String(c.viagem_id) : '',
      desconto: String(c.desconto || 0), adicional: String(c.adicional || 0),
      observacoes: c.observacoes || '',
      forma_pagamento: c.forma_pagamento || '', tipo_cartao: c.tipo_cartao || '',
      num_parcelas: String(c.num_parcelas || 1), data_primeira_parcela: c.data_primeira_parcela || '',
    })
    setEditando(c); setErro(''); setShowForm(true)
  }

  async function verParcelas(c: Cliente) {
    if (parcelasVisiveis === c.id) { setParcelasVisiveis(null); return }
    const r = await api.get(`/parcelas/${c.id}`)
    setParcelas(r.data)
    setParcelasVisiveis(c.id)
  }

  async function togglePago(p: Parcela) {
    await api.patch(`/parcelas/${p.id}`, { pago: !p.pago })
    setParcelas((prev) => prev.map((x) => x.id === p.id ? { ...x, pago: x.pago ? 0 : 1 } : x))
  }

  async function salvar(e: FormEvent) {
    e.preventDefault()
    if (!form.viagem_id) { setErro('Selecione uma viagem'); return }
    if (!form.forma_pagamento) { setErro('Selecione a forma de pagamento'); return }
    if (form.forma_pagamento === 'cartao' && !form.tipo_cartao) { setErro('Selecione débito ou crédito'); return }
    const precisaParcelas = form.forma_pagamento === 'boleto' ||
      (form.forma_pagamento === 'cartao' && form.tipo_cartao === 'credito')
    if (precisaParcelas && (!form.data_primeira_parcela || Number(form.num_parcelas) < 1)) {
      setErro('Informe a data e número de parcelas'); return
    }
    setLoading(true); setErro('')
    try {
      const payload = {
        ...form,
        viagem_id: Number(form.viagem_id),
        desconto: Number(form.desconto) || 0,
        adicional: Number(form.adicional) || 0,
        num_parcelas: Number(form.num_parcelas) || 1,
      }
      if (editando) await api.put(`/clientes/${editando.id}`, payload)
      else await api.post('/clientes', payload)
      setShowForm(false)
      carregar()
    } catch (err: any) {
      setErro(err.response?.data?.erro || 'Erro ao salvar')
    } finally { setLoading(false) }
  }

  async function deletar() {
    if (!deletando) return
    setLoading(true)
    try {
      await api.delete(`/clientes/${deletando.id}`)
      setDeletando(null); carregar()
    } finally { setLoading(false) }
  }

  function exportarCSV() {
    const header = 'Nome,Telefone,CPF,RG,Viagem,Pagamento,Parcelas,Valor Final,Vendedor'
    const rows = clientes.map((c) => {
      const valorFinal = (c.viagem_valor || 0) - (c.desconto || 0) + (c.adicional || 0)
      const pag = c.forma_pagamento === 'cartao' ? `${c.forma_pagamento}/${c.tipo_cartao}` : (c.forma_pagamento || '')
      return `"${c.nome}","${c.telefone}","${c.cpf || ''}","${c.rg || ''}","${c.viagem_nome || ''}","${pag}","${c.num_parcelas || 1}","${valorFinal}","${c.vendedor_nome}"`
    })
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'clientes.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const viagemSelecionada = viagens.find((v) => String(v.id) === form.viagem_id)
  const mostraParcelas = form.forma_pagamento === 'boleto' ||
    (form.forma_pagamento === 'cartao' && form.tipo_cartao === 'credito')

  return (
    <Layout titulo="Clientes">
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <input className="input w-full sm:w-56" placeholder="Buscar por nome, CPF, RG..." value={busca} onChange={(e) => handleBusca(e.target.value)} />
            <select className="input w-full sm:w-48" value={filtroViagem} onChange={(e) => handleFiltroViagem(e.target.value)}>
              <option value="">Todas as viagens</option>
              {viagens.map((v) => <option key={v.id} value={v.id}>{v.nome}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <button className="btn-secondary text-sm" onClick={exportarCSV}>Exportar CSV</button>
            <button className="btn-primary" onClick={abrirNovo}>+ Novo Cliente</button>
          </div>
        </div>

        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Nome</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Telefone</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Viagem</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Pagamento</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Valor Final</th>
                  {isAdmin && <th className="text-left px-4 py-3 font-medium text-gray-600">Vendedor</th>}
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Acoes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {clientes.length === 0 && (
                  <tr><td colSpan={isAdmin ? 7 : 6} className="text-center py-8 text-gray-400">Nenhum cliente encontrado.</td></tr>
                )}
                {clientes.map((c) => {
                  const valorFinal = (c.viagem_valor || 0) - (c.desconto || 0) + (c.adicional || 0)
                  const temParcelas = (c.forma_pagamento === 'boleto' || (c.forma_pagamento === 'cartao' && c.tipo_cartao === 'credito')) && (c.num_parcelas || 1) > 1
                  return (
                    <>
                      <tr key={c.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-800">{c.nome}</td>
                        <td className="px-4 py-3 text-gray-500">{c.telefone}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{c.viagem_nome || <span className="text-gray-300">—</span>}</td>
                        <td className="px-4 py-3">{badgePagamento(c)}</td>
                        <td className="px-4 py-3 font-semibold text-emerald-600 whitespace-nowrap">{c.viagem_valor ? fmtMoeda(valorFinal) : <span className="text-gray-300">—</span>}</td>
                        {isAdmin && <td className="px-4 py-3 text-gray-500 text-xs">{c.vendedor_nome}</td>}
                        <td className="px-4 py-3">
                          <div className="flex gap-1.5">
                            {temParcelas && (
                              <button className="btn-secondary text-xs" onClick={() => verParcelas(c)}>
                                {parcelasVisiveis === c.id ? 'Fechar' : 'Parcelas'}
                              </button>
                            )}
                            <button className="btn-secondary text-xs" onClick={() => abrirEditar(c)}>Editar</button>
                            <button className="btn-danger text-xs" onClick={() => setDeletando(c)}>Excluir</button>
                          </div>
                        </td>
                      </tr>
                      {parcelasVisiveis === c.id && (
                        <tr key={`p-${c.id}`}>
                          <td colSpan={isAdmin ? 7 : 6} className="px-4 pb-3 bg-blue-50">
                            <div className="pt-2">
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Parcelas</p>
                              <div className="flex flex-wrap gap-2">
                                {parcelas.map((p) => (
                                  <button
                                    key={p.id}
                                    onClick={() => togglePago(p)}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${p.pago ? 'bg-emerald-100 border-emerald-300 text-emerald-700' : 'bg-white border-gray-200 text-gray-600 hover:border-blue-300'}`}
                                  >
                                    <span>{p.pago ? '✓' : '○'}</span>
                                    <span>Parcela {p.numero_parcela}</span>
                                    <span className="text-gray-400">{fmtData(p.data_vencimento)}</span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
        <p className="text-xs text-gray-400">{clientes.length} resultado(s)</p>
      </div>

      {/* FORMULARIO */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-lg font-semibold mb-5">{editando ? 'Editar Cliente' : 'Novo Cliente'}</h2>
              {erro && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{erro}</div>}
              <form onSubmit={salvar} className="space-y-5">

                {/* DADOS PESSOAIS */}
                <div>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Dados Pessoais</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="sm:col-span-2">
                      <label className="label">Nome completo *</label>
                      <input className="input" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required />
                    </div>
                    <div>
                      <label className="label">Telefone *</label>
                      <input className="input" value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} placeholder="(00) 00000-0000" required />
                    </div>
                    <div>
                      <label className="label">Data de Nascimento</label>
                      <input type="date" className="input" value={form.data_nascimento} onChange={(e) => setForm({ ...form, data_nascimento: e.target.value })} />
                    </div>
                    <div>
                      <label className="label">CPF</label>
                      <input className="input" value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} placeholder="000.000.000-00" />
                    </div>
                    <div>
                      <label className="label">RG</label>
                      <input className="input" value={form.rg} onChange={(e) => setForm({ ...form, rg: e.target.value })} placeholder="00.000.000-0" />
                    </div>
                  </div>
                </div>

                {/* VIAGEM */}
                <div>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Viagem</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="sm:col-span-2">
                      <label className="label">Viagem *</label>
                      <select className="input" value={form.viagem_id} onChange={(e) => handleViagemSelect(e.target.value)} required>
                        <option value="">Selecione uma viagem...</option>
                        {viagens.map((v) => (
                          <option key={v.id} value={v.id}>{v.nome} — {v.destino} ({fmtData(v.data_saida)})</option>
                        ))}
                      </select>
                    </div>
                    {viagemSelecionada && (
                      <div className="sm:col-span-2 flex flex-wrap gap-4 p-3 bg-blue-50 rounded-lg text-sm">
                        <div><span className="text-gray-500">Destino:</span> <strong>{viagemSelecionada.destino}</strong></div>
                        <div><span className="text-gray-500">Saida:</span> <strong>{fmtData(viagemSelecionada.data_saida)}</strong></div>
                        <div><span className="text-gray-500">Valor:</span> <strong className="text-emerald-600">{fmtMoeda(viagemSelecionada.valor)}</strong></div>
                      </div>
                    )}
                  </div>
                </div>

                {/* FINANCEIRO */}
                <div>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Financeiro</h3>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="label">Desconto (R$)</label>
                      <input type="number" step="0.01" min="0" className="input" value={form.desconto} onChange={(e) => setForm({ ...form, desconto: e.target.value })} />
                    </div>
                    <div>
                      <label className="label">Adicional (R$)</label>
                      <input type="number" step="0.01" min="0" className="input" value={form.adicional} onChange={(e) => setForm({ ...form, adicional: e.target.value })} />
                    </div>
                    <div className="flex items-end pb-0.5">
                      {viagemSelecionada && (
                        <div className="w-full p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-center">
                          <div className="text-xs text-gray-500">Valor Final</div>
                          <div className="font-bold text-emerald-600">{fmtMoeda(viagemSelecionada.valor - Number(form.desconto || 0) + Number(form.adicional || 0))}</div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* PAGAMENTO */}
                <div>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Forma de Pagamento</h3>
                  <div className="space-y-3">
                    {/* Opcoes de pagamento */}
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { value: 'pix', label: 'PIX', icon: '⚡' },
                        { value: 'cartao', label: 'Cartão', icon: '💳' },
                        { value: 'boleto', label: 'Boleto', icon: '📄' },
                      ].map((op) => (
                        <button
                          key={op.value}
                          type="button"
                          onClick={() => setForm({ ...form, forma_pagamento: op.value, tipo_cartao: '', num_parcelas: '1', data_primeira_parcela: '' })}
                          className={`flex flex-col items-center gap-1 py-3 rounded-lg border-2 text-sm font-medium transition-colors ${form.forma_pagamento === op.value ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
                        >
                          <span className="text-xl">{op.icon}</span>
                          {op.label}
                        </button>
                      ))}
                    </div>

                    {/* Cartao: debito ou credito */}
                    {form.forma_pagamento === 'cartao' && (
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { value: 'debito', label: 'Débito' },
                          { value: 'credito', label: 'Crédito' },
                        ].map((op) => (
                          <button
                            key={op.value}
                            type="button"
                            onClick={() => setForm({ ...form, tipo_cartao: op.value, num_parcelas: '1', data_primeira_parcela: '' })}
                            className={`py-2 rounded-lg border-2 text-sm font-medium transition-colors ${form.tipo_cartao === op.value ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
                          >
                            {op.label}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Parcelas: boleto ou credito */}
                    {mostraParcelas && (
                      <div className="grid grid-cols-2 gap-3 p-4 bg-amber-50 rounded-lg border border-amber-200">
                        <div>
                          <label className="label">Numero de Parcelas *</label>
                          <input
                            type="number" min="1" max="24" className="input"
                            value={form.num_parcelas}
                            onChange={(e) => setForm({ ...form, num_parcelas: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="label">Data da 1ª Parcela *</label>
                          <input
                            type="date" className="input"
                            value={form.data_primeira_parcela}
                            onChange={(e) => setForm({ ...form, data_primeira_parcela: e.target.value })}
                          />
                        </div>

                        {/* Preview das parcelas */}
                        {previewParcelas.length > 0 && (
                          <div className="col-span-2">
                            <p className="text-xs font-medium text-gray-500 mb-2">Vencimentos gerados automaticamente:</p>
                            <div className="flex flex-wrap gap-1.5">
                              {previewParcelas.map((d, i) => (
                                <span key={i} className="px-2.5 py-1 bg-white border border-amber-300 rounded-md text-xs text-gray-700">
                                  {i + 1}ª {fmtData(d)}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* OBSERVACOES */}
                <div>
                  <label className="label">Observacoes</label>
                  <textarea className="input resize-none" rows={2} value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} placeholder="Informacoes adicionais..." />
                </div>

                <div className="flex gap-3 justify-end pt-2 border-t border-gray-100">
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
          title="Excluir Cliente"
          message={`Deseja excluir o cliente "${deletando.nome}"? As parcelas tambem serao removidas.`}
          onClose={() => setDeletando(null)}
          onConfirm={deletar}
          confirmLabel="Excluir"
          loading={loading}
        />
      )}
    </Layout>
  )
}
