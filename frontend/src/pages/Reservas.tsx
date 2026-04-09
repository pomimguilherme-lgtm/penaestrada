import { useEffect, useState, FormEvent } from 'react'
import Layout from '../components/Layout'
import api from '../services/api'
import { useAuth } from '../contexts/AuthContext'

interface Passageiro { id: number; nome: string; cpf: string; telefone: string }
interface Viagem { id: number; nome: string; destino: string; valor: number; valor_compartilhado: number; valor_casal: number; data_saida: string }
interface Reserva {
  id: number; viagem_id: number; viagem_nome: string; destino: string; viagem_valor: number
  valor_compartilhado: number; valor_casal: number
  data_saida: string; vendedor_nome: string; forma_pagamento: string; tipo_cartao: string
  num_parcelas: number; desconto: number; adicional: number; valor_final: number
  tipo_quarto: string; qtd_quartos: number
  status: 'pendente' | 'pago' | 'cancelado'; observacoes: string; passageiros: Passageiro[]
}

const emptyForm = {
  viagem_id: '', desconto: 0, adicional: 0, forma_pagamento: '', tipo_cartao: '',
  num_parcelas: 1, data_primeira_parcela: '', status: 'pendente' as string, observacoes: '',
  tipo_quarto: 'compartilhado'
}

const STATUS_COR: Record<string, string> = {
  pago: 'bg-emerald-100 text-emerald-700',
  pendente: 'bg-yellow-100 text-yellow-700',
  cancelado: 'bg-red-100 text-red-600',
}
const PAGTO_LABEL: Record<string, string> = { pix: 'Pix', cartao: 'Cartão', boleto: 'Boleto' }

export default function Reservas() {
  const [reservas, setReservas] = useState<Reserva[]>([])
  const [viagens, setViagens] = useState<Viagem[]>([])
  const [form, setForm] = useState(emptyForm)
  const [passageirosSelecionados, setPassageirosSelecionados] = useState<Passageiro[]>([])
  const [buscaPassageiro, setBuscaPassageiro] = useState('')
  const [resultadosBusca, setResultadosBusca] = useState<Passageiro[]>([])
  const [showBusca, setShowBusca] = useState(false)
  const [showFormNovo, setShowFormNovo] = useState(false)
  const [novoPassageiro, setNovoPassageiro] = useState({ nome: '', cpf: '', rg: '', telefone: '', email: '', data_nascimento: '', observacoes: '' })
  const [editando, setEditando] = useState<Reserva | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [toast, setToast] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')
  const { isAdmin } = useAuth()

  useEffect(() => { carregar(); carregarViagens() }, [filtroStatus])
  useEffect(() => {
    if (buscaPassageiro.length < 2) { setResultadosBusca([]); return }
    const t = setTimeout(() => {
      api.get('/base-clientes', { params: { busca: buscaPassageiro } }).then(r => {
        setResultadosBusca(r.data.filter((c: Passageiro) => !passageirosSelecionados.find(p => p.id === c.id)))
      })
    }, 300)
    return () => clearTimeout(t)
  }, [buscaPassageiro])

  function carregar() {
    api.get('/reservas', { params: { status: filtroStatus || undefined } }).then(r => setReservas(r.data))
  }
  function carregarViagens() {
    api.get('/viagens').then(r => setViagens(r.data))
  }
  function mostrarToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3000) }

  function abrirNovo() {
    setForm(emptyForm); setPassageirosSelecionados([]); setBuscaPassageiro(''); setEditando(null); setErro(''); setShowForm(true)
  }
  function abrirEditar(r: Reserva) {
    setForm({
      viagem_id: String(r.viagem_id), desconto: r.desconto, adicional: r.adicional,
      forma_pagamento: r.forma_pagamento, tipo_cartao: r.tipo_cartao || '',
      num_parcelas: r.num_parcelas, data_primeira_parcela: '', status: r.status, observacoes: r.observacoes || ''
    })
    setPassageirosSelecionados(r.passageiros || [])
    setEditando(r); setErro(''); setShowForm(true)
  }

  function adicionarPassageiro(p: Passageiro) {
    setPassageirosSelecionados(prev => [...prev, p])
    setResultadosBusca([]); setBuscaPassageiro(''); setShowBusca(false)
  }
  function removerPassageiro(id: number) {
    setPassageirosSelecionados(prev => prev.filter(p => p.id !== id))
  }

  async function salvarNovoPassageiro() {
    if (!novoPassageiro.nome) return
    setLoading(true)
    try {
      const r = await api.post('/base-clientes', novoPassageiro)
      adicionarPassageiro(r.data)
      setNovoPassageiro({ nome: '', cpf: '', rg: '', telefone: '', email: '', data_nascimento: '', observacoes: '' })
      setShowFormNovo(false)
      mostrarToast('Passageiro cadastrado e adicionado!')
    } catch (err: any) { setErro(err.response?.data?.erro || 'Erro') }
    finally { setLoading(false) }
  }

  async function salvar(e: FormEvent) {
    e.preventDefault(); setLoading(true); setErro('')
    try {
      const payload = { ...form, viagem_id: Number(form.viagem_id), passageiros: passageirosSelecionados.map(p => p.id) }
      if (editando) await api.put(`/reservas/${editando.id}`, payload)
      else await api.post('/reservas', payload)
      setShowForm(false); carregar(); mostrarToast(editando ? 'Reserva atualizada!' : 'Reserva criada!')
    } catch (err: any) { setErro(err.response?.data?.erro || 'Erro ao salvar') }
    finally { setLoading(false) }
  }

  async function deletar(id: number) {
    if (!confirm('Deseja excluir esta reserva?')) return
    await api.delete(`/reservas/${id}`); carregar(); mostrarToast('Reserva removida')
  }

  async function mudarStatus(id: number, status: string) {
    await api.patch(`/reservas/${id}/status`, { status }); carregar()
  }

  const viagemSelecionada = viagens.find(v => v.id === Number(form.viagem_id))

  // Cálculo automático baseado em tipo_quarto e qtd passageiros
  const qtdPassageiros = passageirosSelecionados.length || 1
  const qtdQuartos = form.tipo_quarto === 'casal' ? Math.ceil(qtdPassageiros / 2) : qtdPassageiros
  const valorUnitario = form.tipo_quarto === 'casal'
    ? (viagemSelecionada?.valor_casal || 0)
    : (viagemSelecionada?.valor_compartilhado || viagemSelecionada?.valor || 0)
  const valorBase = qtdQuartos * valorUnitario
  const valorFinal = valorBase - Number(form.desconto) + Number(form.adicional)

  return (
    <Layout titulo="Reservas">
      {toast && <div className="fixed top-4 right-4 z-50 bg-blue-600 text-white px-5 py-3 rounded-xl shadow-lg text-sm font-medium">{toast}</div>}

      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
          <div className="flex gap-2">
            {['', 'pendente', 'pago', 'cancelado'].map(s => (
              <button key={s} onClick={() => setFiltroStatus(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filtroStatus === s ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {s === '' ? 'Todos' : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
          <button className="btn-primary" onClick={abrirNovo}>+ Nova Reserva</button>
        </div>

        {reservas.length === 0 && (
          <div className="text-center py-16 text-gray-400">Nenhuma reserva encontrada.</div>
        )}

        <div className="space-y-3">
          {reservas.map(r => (
            <div key={r.id} className="card hover:shadow-md transition-shadow">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="font-semibold text-gray-800">{r.viagem_nome}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COR[r.status]}`}>{r.status}</span>
                  </div>
                  <p className="text-sm text-gray-500 mb-2">{r.destino} · {r.data_saida ? new Date(r.data_saida + 'T12:00').toLocaleDateString('pt-BR') : ''}</p>

                  {/* Passageiros */}
                  <div className="flex flex-wrap gap-1 mb-2">
                    {r.passageiros?.map(p => (
                      <span key={p.id} className="bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded-full">👤 {p.nome}</span>
                    ))}
                    {(!r.passageiros || r.passageiros.length === 0) && <span className="text-xs text-gray-400">Sem passageiros</span>}
                  </div>

                  <div className="flex gap-4 text-xs text-gray-500 flex-wrap">
                    <span>{PAGTO_LABEL[r.forma_pagamento] || r.forma_pagamento}</span>
                    {r.tipo_cartao && <span>{r.tipo_cartao}</span>}
                    {r.num_parcelas > 1 && <span>{r.num_parcelas}x</span>}
                    <span>Vendedor: {r.vendedor_nome}</span>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2 min-w-fit">
                  <span className="text-lg font-bold text-emerald-600">
                    R$ {Number(r.valor_final || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                  <div className="flex gap-2 flex-wrap justify-end">
                    {isAdmin && r.status !== 'pago' && (
                      <button onClick={() => mudarStatus(r.id, 'pago')} className="text-xs px-2 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100">Marcar Pago</button>
                    )}
                    <button className="btn-secondary text-xs" onClick={() => abrirEditar(r)}>Editar</button>
                    <button className="btn-danger text-xs" onClick={() => deletar(r.id)}>Excluir</button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal Reserva */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-lg font-semibold mb-4">{editando ? 'Editar Reserva' : 'Nova Reserva'}</h2>
              {erro && <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{erro}</div>}
              <form onSubmit={salvar} className="space-y-4">

                {/* Viagem */}
                <div>
                  <label className="label">Viagem *</label>
                  <select className="input" value={form.viagem_id} onChange={e => setForm({ ...form, viagem_id: e.target.value })} required>
                    <option value="">Selecione a viagem...</option>
                    {viagens.map(v => (
                      <option key={v.id} value={v.id}>{v.nome} — {v.destino} · R$ {Number(v.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</option>
                    ))}
                  </select>
                  {viagemSelecionada && (
                    <p className="text-xs text-gray-500 mt-1">Saída: {new Date(viagemSelecionada.data_saida + 'T12:00').toLocaleDateString('pt-BR')}</p>
                  )}
                </div>

                {/* Passageiros */}
                <div className="border border-gray-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-gray-700">Passageiros</h3>
                    <div className="flex gap-2">
                      <button type="button" className="text-xs px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100" onClick={() => { setShowBusca(true); setShowFormNovo(false) }}>
                        Buscar existente
                      </button>
                      <button type="button" className="text-xs px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100" onClick={() => { setShowFormNovo(true); setShowBusca(false) }}>
                        + Adicionar Passageiro
                      </button>
                    </div>
                  </div>

                  {/* Buscar existente */}
                  {showBusca && (
                    <div className="space-y-2">
                      <input className="input" placeholder="Digite o nome ou CPF..." value={buscaPassageiro} onChange={e => setBuscaPassageiro(e.target.value)} autoFocus />
                      {resultadosBusca.length > 0 && (
                        <div className="border border-gray-200 rounded-lg divide-y">
                          {resultadosBusca.map(p => (
                            <button key={p.id} type="button" onClick={() => adicionarPassageiro(p)} className="w-full text-left px-3 py-2 hover:bg-blue-50 text-sm">
                              <span className="font-medium">{p.nome}</span>
                              {p.cpf && <span className="text-gray-400 ml-2 text-xs">{p.cpf}</span>}
                              {p.telefone && <span className="text-gray-400 ml-2 text-xs">{p.telefone}</span>}
                            </button>
                          ))}
                        </div>
                      )}
                      {buscaPassageiro.length >= 2 && resultadosBusca.length === 0 && (
                        <p className="text-xs text-gray-400">Nenhum cliente encontrado. Cadastre um novo.</p>
                      )}
                    </div>
                  )}

                  {/* Novo passageiro */}
                  {showFormNovo && (
                    <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                      <p className="text-xs font-medium text-gray-600 mb-2">Novo passageiro:</p>
                      <input className="input" placeholder="Nome completo *" value={novoPassageiro.nome} onChange={e => setNovoPassageiro({ ...novoPassageiro, nome: e.target.value })} />
                      <div className="grid grid-cols-2 gap-2">
                        <input className="input" placeholder="CPF" value={novoPassageiro.cpf} onChange={e => setNovoPassageiro({ ...novoPassageiro, cpf: e.target.value })} />
                        <input className="input" placeholder="Telefone" value={novoPassageiro.telefone} onChange={e => setNovoPassageiro({ ...novoPassageiro, telefone: e.target.value })} />
                      </div>
                      <div className="flex gap-2 justify-end">
                        <button type="button" className="btn-secondary text-xs" onClick={() => setShowFormNovo(false)}>Cancelar</button>
                        <button type="button" className="btn-primary text-xs" onClick={salvarNovoPassageiro} disabled={loading || !novoPassageiro.nome}>Cadastrar e Adicionar</button>
                      </div>
                    </div>
                  )}

                  {/* Lista passageiros selecionados */}
                  {passageirosSelecionados.length > 0 && (
                    <div className="space-y-1">
                      {passageirosSelecionados.map(p => (
                        <div key={p.id} className="flex items-center justify-between bg-blue-50 px-3 py-2 rounded-lg">
                          <div>
                            <span className="text-sm font-medium text-blue-800">{p.nome}</span>
                            {p.cpf && <span className="text-xs text-blue-500 ml-2">{p.cpf}</span>}
                          </div>
                          <button type="button" onClick={() => removerPassageiro(p.id)} className="text-red-400 hover:text-red-600 text-xs ml-2">✕ Remover</button>
                        </div>
                      ))}
                    </div>
                  )}
                  {passageirosSelecionados.length === 0 && <p className="text-xs text-gray-400">Nenhum passageiro adicionado.</p>}
                </div>

                {/* Pagamento */}
                <div className="border border-gray-200 rounded-xl p-4 space-y-3">
                  <h3 className="font-medium text-gray-700">Pagamento</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">Forma de Pagamento *</label>
                      <select className="input" value={form.forma_pagamento} onChange={e => setForm({ ...form, forma_pagamento: e.target.value, tipo_cartao: '', num_parcelas: 1 })} required>
                        <option value="">Selecione...</option>
                        <option value="pix">Pix</option>
                        <option value="cartao">Cartão</option>
                        <option value="boleto">Boleto</option>
                      </select>
                    </div>
                    {form.forma_pagamento === 'cartao' && (
                      <div>
                        <label className="label">Tipo de Cartão</label>
                        <select className="input" value={form.tipo_cartao} onChange={e => setForm({ ...form, tipo_cartao: e.target.value })}>
                          <option value="">Selecione...</option>
                          <option value="debito">Débito</option>
                          <option value="credito">Crédito</option>
                        </select>
                      </div>
                    )}
                  </div>
                  {(form.forma_pagamento === 'boleto' || (form.forma_pagamento === 'cartao' && form.tipo_cartao === 'credito')) && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="label">Nº de Parcelas</label>
                        <input type="number" min={1} max={24} className="input" value={form.num_parcelas} onChange={e => setForm({ ...form, num_parcelas: Number(e.target.value) })} />
                      </div>
                      <div>
                        <label className="label">1ª Parcela</label>
                        <input type="date" className="input" value={form.data_primeira_parcela} onChange={e => setForm({ ...form, data_primeira_parcela: e.target.value })} />
                      </div>
                    </div>
                  )}
                  {/* Tipo de quarto */}
                  <div className="sm:col-span-2">
                    <label className="label">Tipo de Quarto</label>
                    <div className="flex gap-4 mt-1">
                      {[{ v: 'compartilhado', label: '🛏 Quarto Compartilhado' }, { v: 'casal', label: '🛌 Quarto Casal' }].map(op => (
                        <label key={op.v} className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" name="tipo_quarto" value={op.v}
                            checked={form.tipo_quarto === op.v}
                            onChange={e => setForm({ ...form, tipo_quarto: e.target.value })}
                            className="accent-blue-600" />
                          <span className="text-sm">{op.label}</span>
                        </label>
                      ))}
                    </div>
                    {viagemSelecionada && (
                      <p className="text-xs text-gray-400 mt-1">
                        {form.tipo_quarto === 'casal'
                          ? `Valor por quarto casal: R$ ${Number(viagemSelecionada.valor_casal || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                          : `Valor por pessoa (compartilhado): R$ ${Number(viagemSelecionada.valor_compartilhado || viagemSelecionada.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                        }
                      </p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">Desconto (R$)</label>
                      <input type="number" step="0.01" min={0} className="input" value={form.desconto} onChange={e => setForm({ ...form, desconto: Number(e.target.value) })} />
                    </div>
                    <div>
                      <label className="label">Adicional (R$)</label>
                      <input type="number" step="0.01" min={0} className="input" value={form.adicional} onChange={e => setForm({ ...form, adicional: Number(e.target.value) })} />
                    </div>
                  </div>
                  {viagemSelecionada && (
                    <div className="text-sm font-medium text-emerald-700 bg-emerald-50 px-3 py-2 rounded-lg space-y-1">
                      <p>{form.tipo_quarto === 'casal' ? `Quartos: ${qtdQuartos} × R$ ${Number(viagemSelecionada.valor_casal || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : `Passageiros: ${qtdPassageiros} × R$ ${Number(viagemSelecionada.valor_compartilhado || viagemSelecionada.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}</p>
                      <p>Valor final: R$ {valorFinal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    </div>
                  )}
                </div>

                {/* Status e obs */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Status</label>
                    <select className="input" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                      <option value="pendente">Pendente</option>
                      <option value="pago">Pago</option>
                      <option value="cancelado">Cancelado</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="label">Observações</label>
                  <textarea className="input resize-none" rows={2} value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} />
                </div>

                <div className="flex gap-3 justify-end pt-2">
                  <button type="button" className="btn-secondary" onClick={() => setShowForm(false)} disabled={loading}>Cancelar</button>
                  <button type="submit" className="btn-primary" disabled={loading}>{loading ? 'Salvando...' : 'Salvar Reserva'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
