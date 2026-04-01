const express = require('express');
const { db } = require('../db');
const { autenticar, apenasAdmin } = require('../middleware/auth');

const router = express.Router();

// ─── RESUMO COMPLETO (admin) ────────────────────────────────────────────────
router.get('/resumo', autenticar, apenasAdmin, async (req, res) => {
  try {
    const { periodo = 'mes' } = req.query;
    let whereData = '';
    if (periodo === 'hoje') whereData = "AND date(r.created_at) = date('now')";
    else if (periodo === 'semana') whereData = "AND r.created_at >= datetime('now', '-7 days')";
    else if (periodo === 'mes') whereData = "AND strftime('%Y-%m', r.created_at) = strftime('%Y-%m', 'now')";

    const base = `FROM reservas r LEFT JOIN viagens v ON r.viagem_id = v.id WHERE r.status != 'cancelado'`;
    const valor = `COALESCE(v.valor - COALESCE(r.desconto,0) + COALESCE(r.adicional,0), 0)`;

    const [rHoje, rMes, rPedidosHoje, rTotal, rTicket, rPeriodo, rDia, rMesG, rPagto, rStatus] = await Promise.all([
      db.prepare(`SELECT COALESCE(SUM(${valor}),0) as total ${base} AND date(r.created_at) = date('now')`).get(),
      db.prepare(`SELECT COALESCE(SUM(${valor}),0) as total ${base} AND strftime('%Y-%m', r.created_at) = strftime('%Y-%m', 'now')`).get(),
      db.prepare(`SELECT COUNT(*) as total FROM reservas r WHERE date(r.created_at) = date('now') AND r.status != 'cancelado'`).get(),
      db.prepare(`SELECT COUNT(DISTINCT rp.cliente_id) as total FROM reserva_passageiros rp`).get(),
      db.prepare(`SELECT COALESCE(AVG(${valor}),0) as media ${base} ${whereData}`).get(),
      db.prepare(`SELECT COALESCE(SUM(${valor}),0) as total, COUNT(*) as pedidos ${base} ${whereData}`).get(),
      db.prepare(`SELECT date(r.created_at) as dia, COUNT(*) as pedidos, COALESCE(SUM(${valor}),0) as total FROM reservas r LEFT JOIN viagens v ON r.viagem_id = v.id WHERE r.created_at >= datetime('now', '-7 days') AND r.status != 'cancelado' GROUP BY date(r.created_at) ORDER BY dia ASC`).all(),
      db.prepare(`SELECT strftime('%Y-%m', r.created_at) as mes, COUNT(*) as pedidos, COALESCE(SUM(${valor}),0) as total FROM reservas r LEFT JOIN viagens v ON r.viagem_id = v.id WHERE r.created_at >= datetime('now', '-6 months') AND r.status != 'cancelado' GROUP BY mes ORDER BY mes ASC`).all(),
      db.prepare(`SELECT COALESCE(r.forma_pagamento,'nao_informado') as forma, COUNT(*) as total, COALESCE(SUM(${valor}),0) as valor FROM reservas r LEFT JOIN viagens v ON r.viagem_id = v.id WHERE r.status != 'cancelado' GROUP BY r.forma_pagamento`).all(),
      db.prepare(`SELECT status, COUNT(*) as total FROM reservas GROUP BY status`).all(),
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

// ─── LISTA DE RESERVAS/PEDIDOS (admin) ──────────────────────────────────────
router.get('/pedidos', autenticar, apenasAdmin, async (req, res) => {
  try {
    const { status, forma_pagamento, periodo, page = 1, limit = 15 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    let where = 'WHERE 1=1';
    const params = [];
    if (status) { where += ' AND r.status = ?'; params.push(status); }
    if (forma_pagamento) { where += ' AND r.forma_pagamento = ?'; params.push(forma_pagamento); }
    if (periodo === 'hoje') where += " AND date(r.created_at) = date('now')";
    else if (periodo === 'semana') where += " AND r.created_at >= datetime('now', '-7 days')";
    else if (periodo === 'mes') where += " AND strftime('%Y-%m',r.created_at) = strftime('%Y-%m','now')";

    const baseQuery = `
      FROM reservas r
      LEFT JOIN viagens v ON r.viagem_id = v.id
      LEFT JOIN usuarios u ON r.vendedor_id = u.id
      LEFT JOIN reserva_passageiros rp ON rp.reserva_id = r.id
      LEFT JOIN base_clientes bc ON bc.id = rp.cliente_id
      ${where}
    `;

    const [rTotal, pedidos] = await Promise.all([
      db.prepare(`SELECT COUNT(DISTINCT r.id) as total ${baseQuery}`).get(...params),
      db.prepare(`
        SELECT r.id, r.status, r.forma_pagamento, r.tipo_cartao, r.num_parcelas, r.created_at,
               v.nome as viagem_nome, v.destino,
               u.nome as vendedor_nome,
               COALESCE(v.valor - COALESCE(r.desconto,0) + COALESCE(r.adicional,0), 0) as valor_final,
               GROUP_CONCAT(bc.nome, ', ') as passageiros_nomes
        ${baseQuery}
        GROUP BY r.id
        ORDER BY r.created_at DESC
        LIMIT ? OFFSET ?
      `).all(...params, Number(limit), offset),
    ]);

    const total = rTotal?.total || 0;
    res.json({ pedidos, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

// ─── ATUALIZAR STATUS DA RESERVA ─────────────────────────────────────────────
router.patch('/pedidos/:id/status', autenticar, apenasAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['pendente', 'pago', 'cancelado'].includes(status)) return res.status(400).json({ erro: 'Status invalido' });
    const r = await db.prepare('SELECT id FROM reservas WHERE id = ?').get(req.params.id);
    if (!r) return res.status(404).json({ erro: 'Reserva nao encontrada' });
    await db.prepare('UPDATE reservas SET status = ? WHERE id = ?').run(status, req.params.id);
    res.json({ id: Number(req.params.id), status });
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

// ─── RESUMO SIMPLES (todos os usuários) ──────────────────────────────────────
router.get('/', autenticar, async (req, res) => {
  try {
    const valor = `COALESCE(v.valor - COALESCE(r.desconto,0) + COALESCE(r.adicional,0), 0)`;

    const [rClientes, rViagens, rVendedores, rReceita, rVendas, rViagem, rProximas] = await Promise.all([
      db.prepare('SELECT COUNT(*) as total FROM base_clientes').get(),
      db.prepare('SELECT COUNT(*) as total FROM viagens').get(),
      db.prepare("SELECT COUNT(*) as total FROM usuarios WHERE tipo = 'vendedor' AND status = 'ativo'").get(),
      db.prepare(`SELECT COALESCE(SUM(${valor}), 0) as total FROM reservas r JOIN viagens v ON r.viagem_id = v.id WHERE r.status != 'cancelado'`).get(),
      db.prepare(`
        SELECT u.id, u.nome,
               COUNT(DISTINCT r.id) as total_clientes,
               COALESCE(SUM(${valor}), 0) as receita
        FROM usuarios u
        LEFT JOIN reservas r ON r.vendedor_id = u.id AND r.status != 'cancelado'
        LEFT JOIN viagens v ON r.viagem_id = v.id
        WHERE u.tipo = 'vendedor'
        GROUP BY u.id, u.nome
        ORDER BY receita DESC
      `).all(),
      db.prepare(`
        SELECT v.id, v.nome, v.destino, v.valor as valor_unitario,
               COUNT(DISTINCT r.id) as total_clientes,
               COALESCE(SUM(${valor}), 0) as receita
        FROM viagens v
        LEFT JOIN reservas r ON r.viagem_id = v.id AND r.status != 'cancelado'
        GROUP BY v.id
        ORDER BY receita DESC
      `).all(),
      db.prepare(`
        SELECT v.*, COUNT(DISTINCT r.id) as total_clientes
        FROM viagens v
        LEFT JOIN reservas r ON r.viagem_id = v.id
        WHERE v.data_saida >= date('now')
        GROUP BY v.id
        ORDER BY v.data_saida ASC
        LIMIT 5
      `).all(),
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
