const express = require('express');
const { db } = require('../db');
const { autenticar, apenasAdmin } = require('../middleware/auth');

const router = express.Router();

// ─── RESUMO (cards do topo + charts) ────────────────────────────────────────
router.get('/resumo', autenticar, apenasAdmin, (req, res) => {
  const { periodo = 'mes' } = req.query;

  let whereData = '';
  if (periodo === 'hoje') whereData = "AND date(c.created_at) = date('now')";
  else if (periodo === 'semana') whereData = "AND c.created_at >= datetime('now', '-7 days')";
  else if (periodo === 'mes') whereData = "AND strftime('%Y-%m', c.created_at) = strftime('%Y-%m', 'now')";

  const base = `
    FROM clientes c
    LEFT JOIN viagens v ON c.viagem_id = v.id
    WHERE c.status != 'cancelado'
  `;

  // Cards principais
  const totalHoje = db.prepare(`
    SELECT COALESCE(SUM(v.valor - COALESCE(c.desconto,0) + COALESCE(c.adicional,0)),0) as total
    ${base} AND date(c.created_at) = date('now')
  `).get().total;

  const totalMes = db.prepare(`
    SELECT COALESCE(SUM(v.valor - COALESCE(c.desconto,0) + COALESCE(c.adicional,0)),0) as total
    ${base} AND strftime('%Y-%m', c.created_at) = strftime('%Y-%m', 'now')
  `).get().total;

  const pedidosHoje = db.prepare(`
    SELECT COUNT(*) as total FROM clientes c
    WHERE date(c.created_at) = date('now') AND c.status != 'cancelado'
  `).get().total;

  const totalClientes = db.prepare(`SELECT COUNT(*) as total FROM clientes`).get().total;

  const ticketMedio = db.prepare(`
    SELECT COALESCE(AVG(v.valor - COALESCE(c.desconto,0) + COALESCE(c.adicional,0)),0) as media
    ${base} ${whereData}
  `).get().media;

  const totalPeriodo = db.prepare(`
    SELECT COALESCE(SUM(v.valor - COALESCE(c.desconto,0) + COALESCE(c.adicional,0)),0) as total,
           COUNT(*) as pedidos
    ${base} ${whereData}
  `).get();

  // Vendas por dia — últimos 7 dias
  const vendasPorDia = db.prepare(`
    SELECT date(c.created_at) as dia,
           COUNT(*) as pedidos,
           COALESCE(SUM(v.valor - COALESCE(c.desconto,0) + COALESCE(c.adicional,0)),0) as total
    FROM clientes c
    LEFT JOIN viagens v ON c.viagem_id = v.id
    WHERE c.created_at >= datetime('now', '-7 days') AND c.status != 'cancelado'
    GROUP BY date(c.created_at)
    ORDER BY dia ASC
  `).all();

  // Vendas por mês — últimos 6 meses
  const vendasPorMes = db.prepare(`
    SELECT strftime('%Y-%m', c.created_at) as mes,
           COUNT(*) as pedidos,
           COALESCE(SUM(v.valor - COALESCE(c.desconto,0) + COALESCE(c.adicional,0)),0) as total
    FROM clientes c
    LEFT JOIN viagens v ON c.viagem_id = v.id
    WHERE c.created_at >= datetime('now', '-6 months') AND c.status != 'cancelado'
    GROUP BY mes
    ORDER BY mes ASC
  `).all();

  // Distribuição por forma de pagamento
  const distribuicaoPagamento = db.prepare(`
    SELECT COALESCE(c.forma_pagamento, 'nao_informado') as forma,
           COUNT(*) as total,
           COALESCE(SUM(v.valor - COALESCE(c.desconto,0) + COALESCE(c.adicional,0)),0) as valor
    FROM clientes c
    LEFT JOIN viagens v ON c.viagem_id = v.id
    WHERE c.status != 'cancelado'
    GROUP BY c.forma_pagamento
  `).all();

  // Status resumo
  const statusResumo = db.prepare(`
    SELECT status, COUNT(*) as total FROM clientes GROUP BY status
  `).all();

  res.json({
    totalHoje, totalMes, pedidosHoje, totalClientes,
    ticketMedio, totalPeriodo,
    vendasPorDia, vendasPorMes, distribuicaoPagamento, statusResumo,
  });
});

// ─── PEDIDOS recentes com filtros e paginação ────────────────────────────────
router.get('/pedidos', autenticar, apenasAdmin, (req, res) => {
  const { status, forma_pagamento, periodo, page = 1, limit = 15 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  let where = 'WHERE 1=1';
  const params = [];

  if (status) { where += ' AND c.status = ?'; params.push(status); }
  if (forma_pagamento) { where += ' AND c.forma_pagamento = ?'; params.push(forma_pagamento); }
  if (periodo === 'hoje') { where += " AND date(c.created_at) = date('now')"; }
  else if (periodo === 'semana') { where += " AND c.created_at >= datetime('now', '-7 days')"; }
  else if (periodo === 'mes') { where += " AND strftime('%Y-%m',c.created_at) = strftime('%Y-%m','now')"; }

  const total = db.prepare(`SELECT COUNT(*) as total FROM clientes c ${where}`).get(...params).total;

  const pedidos = db.prepare(`
    SELECT c.id, c.nome, c.telefone, c.cpf, c.forma_pagamento, c.tipo_cartao,
           c.num_parcelas, c.status, c.created_at,
           v.nome as viagem_nome, v.destino,
           u.nome as vendedor_nome,
           COALESCE(v.valor - COALESCE(c.desconto,0) + COALESCE(c.adicional,0), 0) as valor_final
    FROM clientes c
    LEFT JOIN viagens v ON c.viagem_id = v.id
    LEFT JOIN usuarios u ON c.vendedor_id = u.id
    ${where}
    ORDER BY c.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, Number(limit), offset);

  res.json({ pedidos, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
});

// ─── Atualizar status de um pedido ──────────────────────────────────────────
router.patch('/pedidos/:id/status', autenticar, apenasAdmin, (req, res) => {
  const { status } = req.body;
  if (!['pendente', 'pago', 'cancelado'].includes(status)) {
    return res.status(400).json({ erro: 'Status invalido' });
  }
  const c = db.prepare('SELECT id FROM clientes WHERE id = ?').get(req.params.id);
  if (!c) return res.status(404).json({ erro: 'Pedido nao encontrado' });
  db.prepare("UPDATE clientes SET status = ? WHERE id = ?").run(status, req.params.id);
  res.json({ id: Number(req.params.id), status });
});

// ─── Rota legada (mantém compatibilidade) ───────────────────────────────────
router.get('/', autenticar, (req, res) => {
  const totalClientes = db.prepare('SELECT COUNT(*) as total FROM clientes').get().total;
  const totalViagens = db.prepare('SELECT COUNT(*) as total FROM viagens').get().total;
  const totalVendedores = db.prepare("SELECT COUNT(*) as total FROM usuarios WHERE tipo = 'vendedor' AND status = 'ativo'").get().total;

  const receitaTotal = db.prepare(`
    SELECT COALESCE(SUM(v.valor - COALESCE(c.desconto,0) + COALESCE(c.adicional,0)), 0) as total
    FROM clientes c JOIN viagens v ON c.viagem_id = v.id WHERE c.status != 'cancelado'
  `).get().total;

  const vendasPorVendedor = db.prepare(`
    SELECT u.id, u.nome, COUNT(c.id) as total_clientes,
           COALESCE(SUM(v.valor - COALESCE(c.desconto,0) + COALESCE(c.adicional,0)), 0) as receita
    FROM usuarios u
    LEFT JOIN clientes c ON c.vendedor_id = u.id AND c.status != 'cancelado'
    LEFT JOIN viagens v ON c.viagem_id = v.id
    WHERE u.tipo = 'vendedor' GROUP BY u.id, u.nome ORDER BY receita DESC
  `).all();

  const receitaPorViagem = db.prepare(`
    SELECT v.id, v.nome, v.destino, v.valor as valor_unitario,
           COUNT(c.id) as total_clientes,
           COALESCE(SUM(v.valor - COALESCE(c.desconto,0) + COALESCE(c.adicional,0)), 0) as receita
    FROM viagens v LEFT JOIN clientes c ON c.viagem_id = v.id AND c.status != 'cancelado'
    GROUP BY v.id ORDER BY receita DESC
  `).all();

  const proximasViagens = db.prepare(`
    SELECT v.*, COUNT(c.id) as total_clientes FROM viagens v
    LEFT JOIN clientes c ON c.viagem_id = v.id
    WHERE v.data_saida >= date('now') GROUP BY v.id ORDER BY v.data_saida ASC LIMIT 5
  `).all();

  res.json({ totalClientes, totalViagens, totalVendedores, receitaTotal, vendasPorVendedor, receitaPorViagem, proximasViagens });
});

module.exports = router;
