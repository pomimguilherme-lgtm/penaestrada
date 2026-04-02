import { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import api from '../services/api'
import { useAuth } from '../contexts/AuthContext'

interface Viagem {
  id: number
  nome: string
  destino: string
  data_saida: string
}

interface Passageiro {
  cliente_id: number
  nome: string
  cpf: string
  rg: string
  data_nascimento: string
  telefone: string
  email: string
  reserva_id: number
  forma_pagamento: string
  tipo_cartao: string
  num_parcelas: number
  status: string
  valor_final: number
  vendedor_nome: string
  viagem_nome: string
  destino: string
  data_saida: string
}

const STATUS_COR: Record<string, string> = {
  pago: 'bg-emerald-100 text-emerald-700',
  pendente: 'bg-amber-100 text-amber-700',
  cancelado: 'bg-red-100 text-red-600',
}

const PAGTO_LABEL: Record<string, string> = { pix: 'PIX', cartao: 'Cartão', boleto: 'Boleto' }

const fmtMoeda = (v: number) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtData = (s: string) => s ? new Date(s + 'T12:00').toLocaleDateString('pt-BR') : '—'

export default function Passageiros() {
  const [viagens, setViagens] = useState<Viagem[]>([])
  const [passageiros, setPassageiros] = useState<Passageiro[]>([])
  const [viagemId, setViagemId] = useState('')
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')
  const [detalhe, setDetalhe] = useState<Passageiro | null>(null)
  const { isAdmin } = useAuth()

  useEffect(() => {
    api.get('/viagens').then(r => setViagens(r.data))
  }, [])

  useEffect(() => {
    if (!viagemId) { setPassageiros([]); return }
    const params: Record<string, string> = { viagem_id: viagemId }
    if (busca) params.busca = busca
    if (filtroStatus) params.status = filtroStatus
    api.get('/passageiros', { params }).then(r => setPassageiros(r.data))
  }, [viagemId, busca, filtroStatus])

  const viagemSelecionada = viagens.find(v => v.id === Number(viagemId))

  return (
    <Layout titulo="Passageiros">
      <div className="space-y-5">

        {/* Seletor de viagem */}
        <div className="card p-4">
          <label className="label mb-1">Selecione a viagem</label>
          <select
            className="input max-w-lg"
            value={viagemId}
            onChange={e => { setViagemId(e.target.value); setBusca(''); setFiltroStatus('') }}
          >
            <option value="">Escolha uma viagem...</option>
            {viagens.map(v => (
              <option key={v.id} value={v.id}>
                {v.nome} — {v.destino} · {fmtData(v.data_saida)}
              </option>
            ))}
          </select>
          {viagemSelecionada && (
            <p className="text-xs text-gray-400 mt-1">
              Saída: {fmtData(viagemSelecionada.data_saida)} · {passageiros.length} passageiro(s){!isAdmin && ' (seus)'}
            </p>
          )}
        </div>

        {/* Filtros */}
        {viagemId && (
          <div className="flex flex-wrap gap-3 items-center">
            <input
              className="input max-w-xs"
              placeholder="Buscar por nome, CPF..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
            />
            <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-medium">
              {['', 'pendente', 'pago', 'cancelado'].map(s => (
                <button
                  key={s}
                  onClick={() => setFiltroStatus(s)}
                  className={`px-3 py-1.5 transition-colors border-l first:border-l-0 border-gray-200 ${filtroStatus === s ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                >
                  {s === '' ? 'Todos' : s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Tabela */}
        {viagemId && (
          <div className="card overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Nome</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">CPF / RG</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 hidden lg:table-cell">Nascimento</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">Pagamento</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                    {isAdmin && <th className="text-left px-4 py-3 font-medium text-gray-600 hidden lg:table-cell">Vendedor</th>}
                    <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">Valor</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {passageiros.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-12 text-gray-400">
                        Nenhum passageiro encontrado para esta viagem.
                      </td>
                    </tr>
                  ) : passageiros.map((p, i) => (
                    <tr key={`${p.cliente_id}-${p.reserva_id}-${i}`} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-800">{p.nome}</td>
                      <td className="px-4 py-3 text-gray-500 hidden md:table-cell">
                        {p.cpf || p.rg || '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-500 hidden lg:table-cell">{fmtData(p.data_nascimento)}</td>
                      <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">
                        {PAGTO_LABEL[p.forma_pagamento] || p.forma_pagamento || '—'}
                        {p.tipo_cartao ? ` (${p.tipo_cartao})` : ''}
                        {(p.num_parcelas || 1) > 1 ? ` ${p.num_parcelas}x` : ''}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COR[p.status] || 'bg-gray-100 text-gray-600'}`}>
                          {p.status}
                        </span>
                      </td>
                      {isAdmin && <td className="px-4 py-3 text-gray-500 hidden lg:table-cell">{p.vendedor_nome}</td>}
                      <td className="px-4 py-3 font-semibold text-emerald-600 hidden md:table-cell">{fmtMoeda(p.valor_final)}</td>
                      <td className="px-4 py-3">
                        <button className="btn-secondary text-xs" onClick={() => setDetalhe(p)}>Detalhes</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {passageiros.length > 0 && (
              <div className="px-4 py-2 border-t border-gray-100 text-xs text-gray-400">
                {passageiros.length} passageiro(s)
              </div>
            )}
          </div>
        )}

        {!viagemId && (
          <div className="text-center py-16 text-gray-400">
            <div className="text-5xl mb-3">✈️</div>
            <p className="text-sm">Selecione uma viagem para ver os passageiros</p>
          </div>
        )}
      </div>

      {/* Modal detalhe */}
      {detalhe && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setDetalhe(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex justify-between items-start mb-5">
                <div>
                  <h2 className="text-lg font-semibold text-gray-800">{detalhe.nome}</h2>
                  <p className="text-xs text-gray-400">Reserva #{detalhe.reserva_id}</p>
                </div>
                <button onClick={() => setDetalhe(null)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
              </div>
              <div className="space-y-2 text-sm">
                {[
                  ['CPF', detalhe.cpf],
                  ['RG', detalhe.rg],
                  ['Nascimento', fmtData(detalhe.data_nascimento)],
                  ['Telefone', detalhe.telefone],
                  ['Email', detalhe.email],
                  ['Pagamento', `${PAGTO_LABEL[detalhe.forma_pagamento] || '—'}${detalhe.tipo_cartao ? ` (${detalhe.tipo_cartao})` : ''}${(detalhe.num_parcelas || 1) > 1 ? ` ${detalhe.num_parcelas}x` : ''}`],
                  ['Valor Final', fmtMoeda(detalhe.valor_final)],
                  ['Vendedor', detalhe.vendedor_nome],
                  ['Status', detalhe.status],
                ].map(([label, value]) => value && (
                  <div key={label} className="flex justify-between py-1.5 border-b border-gray-50">
                    <span className="text-gray-500">{label}</span>
                    <span className="font-medium text-gray-800">{value}</span>
                  </div>
                ))}
              </div>
              <div className="mt-5 flex justify-end">
                <button className="btn-secondary" onClick={() => setDetalhe(null)}>Fechar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
