import { useEffect, useRef, useState, useCallback } from 'react'
import Layout from '../components/Layout'
import api from '../services/api'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'

// ─── tipos ───────────────────────────────────────────────────────────────────
interface Resumo {
  totalHoje: number
  totalMes: number
  pedidosHoje: number
  totalClientes: number
  ticketMedio: number
  totalPeriodo: { total: number; pedidos: number }
  vendasPorDia: { dia: string; pedidos: number; total: number }[]
  vendasPorMes: { mes: string; pedidos: number; total: number }[]
  distribuicaoPagamento: { forma: string; total: number; valor: number }[]
  statusResumo: { status: string; total: number }[]
}

interface Pedido {
  id: number
  passageiros_nomes: string | null
  viagem_nome: string | null
  destino: string | null
  vendedor_nome: string
  forma_pagamento: string | null
  tipo_cartao: string | null
  num_parcelas: number
  status: string
  created_at: string
  valor_final: number
}

interface PedidosData {
  pedidos: Pedido[]
  total: number
  page: number
  pages: number
}

// ─── helpers ──────────────────────────────────────────────────────────────────
const fmtMoeda = (v: number) =>
  Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const fmtMes = (s: string) => {
  const [y, m] = s.split('-')
  return new Date(Number(y), Number(m) - 1).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
}

const fmtDia = (s: string) => {
  const d = new Date(s + 'T12:00')
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

const fmtHora = (s: string) => {
  const d = new Date(s)
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

const PAGAMENTO_LABEL: Record<string, string> = {
  pix: 'PIX', cartao: 'Cartão', boleto: 'Boleto', nao_informado: 'Não informado',
}

const PAGAMENTO_COR: Record<string, string> = {
  pix: '#10b981', cartao: '#3b82f6', boleto: '#f59e0b', nao_informado: '#9ca3af',
}

const STATUS_COR: Record<string, string> = {
  pago: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  pendente: 'bg-amber-100 text-amber-700 border-amber-200',
  cancelado: 'bg-red-100 text-red-700 border-red-200',
}

const STATUS_LABEL: Record<string, string> = {
  pago: 'Pago', pendente: 'Pendente', cancelado: 'Cancelado',
}

// ─── StatCard ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, icon, sub, color = 'bg-blue-50' }: {
  label: string; value: string | number; icon: string; sub?: string; color?: string
}) {
  return (
    <div className="card flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0 ${color}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-xl font-bold text-gray-800 truncate">{value}</div>
        <div className="text-sm text-gray-500">{label}</div>
        {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
      </div>
    </div>
  )
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────
function TooltipMoeda({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-sm">
      <p className="font-medium text-gray-700 mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: {typeof p.value === 'number' && p.name.toLowerCase().includes('r$') ? fmtMoeda(p.value) : p.value}
        </p>
      ))}
    </div>
  )
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [resumo, setResumo] = useState<Resumo | null>(null)
  const [pedidosData, setPedidosData] = useState<PedidosData | null>(null)
  const [periodo, setPeriodo] = useState('mes')
  const [filtroPagamento, setFiltroPagamento] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')
  const [page, setPage] = useState(1)
  const [detalhe, setDetalhe] = useState<Pedido | null>(null)
  const [alerta, setAlerta] = useState<string | null>(null)
  const prevTotal = useRef<number>(0)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const carregarResumo = useCallback(async () => {
    const r = await api.get(`/dashboard/resumo?periodo=${periodo}`)
    setResumo(r.data)
    const novoTotal = r.data.pedidosHoje
    if (prevTotal.current > 0 && novoTotal > prevTotal.current) {
      setAlerta('Nova reserva recebida!')
      setTimeout(() => setAlerta(null), 5000)
    }
    prevTotal.current = novoTotal
  }, [periodo])

  const carregarPedidos = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), limit: '12' })
    if (filtroPagamento) params.append('forma_pagamento', filtroPagamento)
    if (filtroStatus) params.append('status', filtroStatus)
    if (periodo !== 'todos') params.append('periodo', periodo)
    const r = await api.get(`/dashboard/pedidos?${params}`)
    setPedidosData(r.data)
  }, [page, filtroPagamento, filtroStatus, periodo])

  useEffect(() => { carregarResumo(); carregarPedidos() }, [carregarResumo, carregarPedidos])

  useEffect(() => {
    pollingRef.current = setInterval(() => { carregarResumo(); carregarPedidos() }, 30000)
    return () => { if (pollingRef.current) clearInterval(pollingRef.current) }
  }, [carregarResumo, carregarPedidos])

  async function atualizarStatus(id: number, status: string) {
    await api.patch(`/dashboard/pedidos/${id}/status`, { status })
    carregarPedidos(); carregarResumo()
    if (detalhe?.id === id) setDetalhe((d) => d ? { ...d, status } : d)
  }

  if (!resumo) return (
    <Layout titulo="Dashboard">
      <div className="flex items-center justify-center h-64 text-gray-400">
        <div className="text-center">
          <div className="text-4xl mb-3">📊</div>
          <p>Carregando dashboard...</p>
        </div>
      </div>
    </Layout>
  )

  const pieData = resumo.distribuicaoPagamento.map((d) => ({
    name: PAGAMENTO_LABEL[d.forma] || d.forma,
    value: d.total,
    cor: PAGAMENTO_COR[d.forma] || '#9ca3af',
  }))

  return (
    <Layout titulo="Dashboard">
      <div className="space-y-6">

        {/* ALERTA */}
        {alerta && (
          <div className="fixed top-4 right-4 z-50 flex items-center gap-3 bg-emerald-600 text-white px-5 py-3 rounded-xl shadow-xl animate-pulse">
            <span className="text-xl">🔔</span>
            <span className="font-medium">{alerta}</span>
            <button onClick={() => setAlerta(null)} className="ml-2 text-white/70 hover:text-white">✕</button>
          </div>
        )}

        {/* FILTRO PERÍODO */}
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-sm text-gray-500 font-medium">Período:</span>
          {[
            { value: 'hoje', label: 'Hoje' },
            { value: 'semana', label: 'Semana' },
            { value: 'mes', label: 'Mês' },
            { value: 'todos', label: 'Todos' },
          ].map((op) => (
            <button key={op.value} onClick={() => { setPeriodo(op.value); setPage(1) }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${periodo === op.value ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-blue-300'}`}>
              {op.label}
            </button>
          ))}
          <button onClick={() => { carregarResumo(); carregarPedidos() }}
            className="ml-auto px-3 py-1.5 rounded-lg text-sm text-gray-500 border border-gray-200 hover:bg-gray-50 flex items-center gap-1.5">
            🔄 Atualizar
          </button>
        </div>

        {/* CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard label="Vendido Hoje" value={fmtMoeda(resumo.totalHoje)} icon="💰" color="bg-emerald-50" />
          <StatCard label="Vendido no Mês" value={fmtMoeda(resumo.totalMes)} icon="📈" color="bg-blue-50" />
          <StatCard label="Reservas Hoje" value={resumo.pedidosHoje} icon="📋" color="bg-amber-50" />
          <StatCard label="Total Passageiros" value={resumo.totalClientes} icon="👥" color="bg-purple-50" />
          <StatCard label="Ticket Médio" value={fmtMoeda(resumo.ticketMedio)} icon="🎯" color="bg-rose-50" sub="por reserva" />
        </div>

        {/* STATUS BADGES */}
        <div className="flex flex-wrap gap-3">
          {resumo.statusResumo.map((s) => (
            <div key={s.status} className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-medium ${STATUS_COR[s.status] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
              <span>{STATUS_LABEL[s.status] || s.status}</span>
              <span className="font-bold">{s.total}</span>
            </div>
          ))}
        </div>

        {/* GRÁFICOS */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          <div className="card lg:col-span-2">
            <h3 className="font-semibold text-gray-700 mb-4">Reservas por Dia (últimos 7 dias)</h3>
            {resumo.vendasPorDia.length === 0 ? (
              <div className="h-40 flex items-center justify-center text-gray-400 text-sm">Sem dados no período</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={resumo.vendasPorDia.map((d) => ({ ...d, dia: fmtDia(d.dia) }))}>
                  <XAxis dataKey="dia" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip content={<TooltipMoeda />} formatter={(v) => fmtMoeda(v as number)} />
                  <Bar dataKey="total" name="R$ Total" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="card">
            <h3 className="font-semibold text-gray-700 mb-4">Forma de Pagamento</h3>
            {pieData.length === 0 ? (
              <div className="h-40 flex items-center justify-center text-gray-400 text-sm">Sem dados</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70}
                    label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                    labelLine={false} fontSize={11}>
                    {pieData.map((entry, i) => <Cell key={i} fill={entry.cor} />)}
                  </Pie>
                  <Tooltip formatter={(v) => [`${v as number} reservas`]} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="card lg:col-span-3">
            <h3 className="font-semibold text-gray-700 mb-4">Reservas por Mês (últimos 6 meses)</h3>
            {resumo.vendasPorMes.length === 0 ? (
              <div className="h-40 flex items-center justify-center text-gray-400 text-sm">Sem dados no período</div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={resumo.vendasPorMes.map((d) => ({ ...d, mes: fmtMes(d.mes) }))}>
                  <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v, name) => [name === 'total' ? fmtMoeda(v as number) : v, name === 'total' ? 'Receita' : 'Reservas']} />
                  <Bar dataKey="total" name="total" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="pedidos" name="pedidos" fill="#93c5fd" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* RESERVAS RECENTES */}
        <div className="card p-0 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex flex-wrap gap-3 items-center justify-between">
            <h3 className="font-semibold text-gray-700">Reservas Recentes</h3>
            <div className="flex flex-wrap gap-2">
              <select className="input py-1.5 text-sm w-auto"
                value={filtroStatus} onChange={(e) => { setFiltroStatus(e.target.value); setPage(1) }}>
                <option value="">Todos os status</option>
                <option value="pendente">Pendente</option>
                <option value="pago">Pago</option>
                <option value="cancelado">Cancelado</option>
              </select>
              <select className="input py-1.5 text-sm w-auto"
                value={filtroPagamento} onChange={(e) => { setFiltroPagamento(e.target.value); setPage(1) }}>
                <option value="">Todos pagamentos</option>
                <option value="pix">PIX</option>
                <option value="cartao">Cartão</option>
                <option value="boleto">Boleto</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Passageiros</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Viagem</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Pagamento</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Valor</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Data</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {!pedidosData || pedidosData.pedidos.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-10 text-gray-400">Nenhuma reserva encontrada.</td></tr>
                ) : pedidosData.pedidos.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setDetalhe(p)}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-800">{p.passageiros_nomes || <span className="text-gray-400 text-xs">Sem passageiros</span>}</div>
                      <div className="text-xs text-gray-400">{p.vendedor_nome}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{p.viagem_nome || '—'}</td>
                    <td className="px-4 py-3">
                      {p.forma_pagamento ? (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium"
                          style={{ backgroundColor: PAGAMENTO_COR[p.forma_pagamento] + '20', color: PAGAMENTO_COR[p.forma_pagamento] }}>
                          {PAGAMENTO_LABEL[p.forma_pagamento]}
                          {p.forma_pagamento === 'cartao' && p.tipo_cartao ? ` ${p.tipo_cartao}` : ''}
                          {(p.num_parcelas || 1) > 1 ? ` ${p.num_parcelas}x` : ''}
                        </span>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 font-semibold text-emerald-600 whitespace-nowrap">{fmtMoeda(p.valor_final)}</td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <select
                        className={`text-xs font-medium px-2 py-1 rounded-lg border cursor-pointer ${STATUS_COR[p.status] || 'bg-gray-100 text-gray-600 border-gray-200'}`}
                        value={p.status}
                        onChange={(e) => atualizarStatus(p.id, e.target.value)}>
                        <option value="pendente">Pendente</option>
                        <option value="pago">Pago</option>
                        <option value="cancelado">Cancelado</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{fmtHora(p.created_at)}</td>
                    <td className="px-4 py-3">
                      <button className="btn-secondary text-xs" onClick={(e) => { e.stopPropagation(); setDetalhe(p) }}>Detalhes</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pedidosData && pedidosData.pages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
              <span className="text-xs text-gray-500">{pedidosData.total} reservas no total</span>
              <div className="flex gap-1">
                <button className="btn-secondary text-xs px-3 py-1" disabled={page === 1} onClick={() => setPage(page - 1)}>‹ Anterior</button>
                <span className="px-3 py-1 text-xs text-gray-600">{page} / {pedidosData.pages}</span>
                <button className="btn-secondary text-xs px-3 py-1" disabled={page >= pedidosData.pages} onClick={() => setPage(page + 1)}>Próximo ›</button>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* MODAL DETALHE */}
      {detalhe && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setDetalhe(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-start justify-between mb-5">
                <div>
                  <h2 className="text-lg font-semibold text-gray-800">{detalhe.viagem_nome || 'Reserva'}</h2>
                  <p className="text-sm text-gray-400">Reserva #{detalhe.id}</p>
                </div>
                <button onClick={() => setDetalhe(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
              </div>

              <div className="space-y-3 text-sm">
                <Row label="Passageiros" value={detalhe.passageiros_nomes || 'Nenhum'} />
                <Row label="Destino" value={detalhe.destino || '—'} />
                <Row label="Vendedor" value={detalhe.vendedor_nome} />
                <Row label="Pagamento" value={
                  `${PAGAMENTO_LABEL[detalhe.forma_pagamento || ''] || '—'}${detalhe.tipo_cartao ? ` (${detalhe.tipo_cartao})` : ''}${(detalhe.num_parcelas || 1) > 1 ? ` — ${detalhe.num_parcelas}x` : ''}`
                } />
                <Row label="Valor Final" value={fmtMoeda(detalhe.valor_final)} highlight />
                <Row label="Data" value={fmtHora(detalhe.created_at)} />
                <div className="flex items-center justify-between py-2 border-t border-gray-100 mt-2">
                  <span className="text-gray-500 font-medium">Status</span>
                  <select
                    className={`text-xs font-medium px-3 py-1.5 rounded-lg border cursor-pointer ${STATUS_COR[detalhe.status]}`}
                    value={detalhe.status}
                    onChange={(e) => atualizarStatus(detalhe.id, e.target.value)}>
                    <option value="pendente">Pendente</option>
                    <option value="pago">Pago</option>
                    <option value="cancelado">Cancelado</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between py-1.5 border-b border-gray-50">
      <span className="text-gray-500">{label}</span>
      <span className={`font-medium text-right max-w-xs ${highlight ? 'text-emerald-600 text-base' : 'text-gray-800'}`}>{value}</span>
    </div>
  )
}
