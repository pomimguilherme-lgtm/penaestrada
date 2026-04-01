const express = require('express');
const { db } = require('../db');
const { autenticar, apenasAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/resumo', autenticar, apenasAdmin, async (req, res) => {
  try {
    const { periodo = 'mes' } = req.query;
    let whereData = '';
    if (periodo === 'hoje') whereData = "AND date(c.created_at) = date('now')";
    else if (periodo === 'semana') whereData = "AND c.created_at >= datetime('now', '-7 days')";
    else if (periodo === 'mes') whereData = "AND strftime('%Y-%m', c.created_at) = strftime('%Y-%m', 'now')";

    const base = `FROM clientes c LEFT JOIN viagens v ON c.viagem_id = v.id WHERE c.status != 'cancelado'`;

    const [rHoje, rMes, rPedidosHoje, rTotal, rTicket, rPeriodo, rDia, rMesG, rPagto, rStatus] = await Promise.all([
      db.prepare(`SELECT COALESCE(SUM(v.valor - COALESCE(c.desconto,0) + COALESCE(c.adicional,0)),0) as total ${base} AND date(c.created_at) = date('now')`).get(),
      db.prepare(`SELECT COALESCE(SUM(v.valor - COALESCE(c.desconto,0) + COALESCE(c.adicional,0)),0) as total ${base} AND strftime('%Y-%m', c.created_at) = strftime('%Y-%m', 'now')`).get(),
      db.prepare(`SELECT COUNT(*) as total FROM clientes c WHERE date(c.created_at) = date('now') AND c.status != 'cancelado'`).get(),
      db.prepare(`SELECT COUNT(*) as total FROM clientes`).get(),
      db.prepare(`SELECT COALESCE(AVG(v.valor - COALESCE(c.desconto,0) + COALESCE(c.adicional,0)),0) as media ${base} ${whereData}`).get(),
      db.prepare(`SELECT COALESCE(SUM(v.valor - COALESCE(c.desconto,0) + COALESCE(c.adicional,0)),0) as total, COUNT(*) as pedidos ${base} ${whereData}`).get(),
      db.prepare(`SELECT date(c.created_at) as dia, COUNT(*) as pedidos, COALESCE(SUM(v.valor - COALESCE(c.desconto,0) + COALESCE(c.adicional,0)),0) as total FROM clientes c LEFT JOIN viagens v ON c.viagem_id = v.id WHERE c.created_at >= datetime('now', '-7 days') AND c.status != 'cancelado' GROUP BY date(c.created_at) ORDER BY dia ASC`).all(),
      db.prepare(`SELECT strftime('%Y-%m', c.created_at) as mes, COUNT(*) as pedidos, COALESCE(SUM(v.valor - COALESCE(c.desconto,0) + COALESCE(c.adicional,0)),0) as total FROM clientes c LEFT JOIN viagens v ON c.viagem_id = v.id WHERE c.created_at >= datetime('now', '-6 months') AND c.status != 'cancelado' GROUP BY mes ORDER BY mes ASC`).all(),
      db.prepare(`SELECT COALESCE(c.forma_pagamento,'nao_informado') as forma, COUNT(*) as total, COALESCE(SUM(v.valor - COALESCE(c.desconto,0) + COALESCE(c.adicional,0)),0) as valor FROM clientes c LEFT JOIN viagens v ON c.viagem_id = v.id WHERE c.status != 'cancelado' GROUP BY c.forma_pagamento`).all(),
      db.prepare(`SELECT status, COUNT(*) as total FROM clientes GROUP BY status`).all(),
    ]);

    res.json({
      totalHoje: rHoje?.total || 0,
      totalMes: rMes?.total || 0,
      pedidosHoje: rPedidosHoje?.total || 0,
      totalClientes: rTotal?.total || 0,
      ticketMedio: rTicket?.media || 0,
      totalPeriodo: rPeriodo,
      vendasPorDia: rDia,
      vendasPorMes: rMesG,
      distribuicaoPagamento: rPagto,
      statusResumo: rStatus,
    });
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

router.get('/pedidos', autenticar, apenasAdmin, async (req, res) => {
  try {
    const { status, forma_pagamento, periodo, page = 1, limit = 15 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    let where = 'WHERE 1=1';
    const params = [];
    if (status) { where += ' AND c.status = ?'; params.push(status); }
    if (forma_pagamento) { where += ' AND c.forma_pagamento = ?'; params.push(forma_pagamento); }
    if (periodo === 'hoje') where += " AND date(c.created_at) = date('now')";
    else if (periodo === 'semana') where += " AND c.created_at >= datetime('now', '-7 days')";
    else if (periodo === 'mes') where += " AND strftime('%Y-%m',c.created_at) = strftime('%Y-%m','now')";

    const [rTotal, pedidos] = await Promise.all([
      db.prepare(`SELECT COUNT(*) as total FROM clientes c ${where}`).get(...params),
      db.prepare(`SELECT c.id, c.nome, c.telefone, c.cpf, c.forma_pagamento, c.tipo_cartao, c.num_parcelas, c.status, c.created_at, v.nome as viagem_nome, v.destino, u.nome as vendedor_nome, COALESCE(v.valor - COALESCE(c.desconto,0) + COALESCE(c.adicional,0), 0) as valor_final FROM clientes c LEFT JOIN viagens v ON c.viagem_id = v.id LEFT JOIN usuarios u ON c.vendedor_id = u.id ${where} ORDER BY c.created_at DESC LIMIT ? OFFSET ?`).all(...params, Number(limit), offset),
    ]);

    const total = rTotal?.total || 0;
    res.json({ pedidos, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

router.patch('/pedidos/:id/status', autenticar, apenasAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['pendente', 'pago', 'cancelado'].includes(status)) return res.status(400).json({ erro: 'Status invalido' });
    const c = await db.prepare('SELECT id FROM clientes WHERE id = ?').get(req.params.id);
    if (!c) return res.status(404).json({ erro: 'Pedido nao encontrado' });
    await db.prepare('UPDATE clientes SET status = ? WHERE id = ?').run(status, req.params.id);
    res.json({ id: Number(req.params.id), status });
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

router.get('/', autenticar, async (req, res) => {
  try {
    const [rClientes, rViagens, rVendedores, rReceita, rVendas, rViagem, rProximas] = await Promise.all([
      db.prepare('SELECT COUNT(*) as total FROM clientes').get(),
      db.prepare('SELECT COUNT(*) as total FROM viagens').get(),
      db.prepare("SELECT COUNT(*) as total FROM usuarios WHERE tipo = 'vendedor' AND status = 'ativo'").get(),
      db.prepare(`SELECT COALESCE(SUM(v.valor - COALESCE(c.desconto,0) + COALESCE(c.adicional,0)), 0) as total FROM clientes c JOIN viagens v ON c.viagem_id = v.id WHERE c.status != 'cancelado'`).get(),
      db.prepare(`SELECT u.id, u.nome, COUNT(c.id) as total_clientes, COALESCE(SUM(v.valor - COALESCE(c.desconto,0) + COALESCE(c.adicional,0)), 0) as receita FROM usuarios u LEFT JOIN clientes c ON c.vendedor_id = u.id AND c.status != 'cancelado' LEFT JOIN viagens v ON c.viagem_id = v.id WHERE u.tipo = 'vendedor' GROUP BY u.id, u.nome ORDER BY receita DESC`).all(),
      db.prepare(`SELECT v.id, v.nome, v.destino, v.valor as valor_unitario, COUNT(c.id) as total_clientes, COALESCE(SUM(v.valor - COALESCE(c.desconto,0) + COALESCE(c.adicional,0)), 0) as receita FROM viagens v LEFT JOIN clientes c ON c.viagem_id = v.id AND c.status != 'cancelado' GROUP BY v.id ORDER BY receita DESC`).all(),
      db.prepare(`SELECT v.*, COUNT(c.id) as total_clientes FROM viagens v LEFT JOIN clientes c ON c.viagem_id = v.id WHERE v.data_saida >= date('now') GROUP BY v.id ORDER BY v.data_saida ASC LIMIT 5`).all(),
    ]);
    res.json({
      totalClientes: rClientes?.total || 0,
      totalViagens: rViagens?.total || 0,
      totalVendedores: rVendedores?.total || 0,
      receitaTotal: rReceita?.total || 0,
      vendasPorVendedor: rVendas,
      receitaPorViagem: rViagem,
      proximasViagens: rProximas,
    });
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

module.exports = router;
