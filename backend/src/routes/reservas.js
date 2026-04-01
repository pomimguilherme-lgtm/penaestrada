const express = require('express');
const { db } = require('../db');
const { autenticar, apenasAdmin } = require('../middleware/auth');

const router = express.Router();

async function gerarParcelasReserva(reservaId, numParcelas, dataPrimeira) {
  await db.prepare('DELETE FROM parcelas_reserva WHERE reserva_id = ?').run(reservaId);
  const base = new Date(dataPrimeira + 'T12:00:00');
  for (let i = 0; i < numParcelas; i++) {
    const d = new Date(base);
    d.setMonth(d.getMonth() + i);
    const iso = d.toISOString().split('T')[0];
    await db.prepare('INSERT INTO parcelas_reserva (reserva_id, numero_parcela, data_vencimento) VALUES (?, ?, ?)').run(reservaId, i + 1, iso);
  }
}

async function buscarPassageiros(reservaId) {
  return db.prepare(
    `SELECT bc.*, rp.id as vinculo_id FROM reserva_passageiros rp
     JOIN base_clientes bc ON rp.cliente_id = bc.id
     WHERE rp.reserva_id = ? ORDER BY bc.nome ASC`
  ).all(reservaId);
}

// Listar reservas
router.get('/', autenticar, async (req, res) => {
  try {
    const { status, viagem_id, busca, page = 1, limit = 50 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    let where = 'WHERE 1=1';
    const params = [];
    if (req.usuario.tipo === 'vendedor') { where += ' AND r.vendedor_id = ?'; params.push(req.usuario.id); }
    if (status) { where += ' AND r.status = ?'; params.push(status); }
    if (viagem_id) { where += ' AND r.viagem_id = ?'; params.push(viagem_id); }

    const reservas = await db.prepare(
      `SELECT r.*, v.nome as viagem_nome, v.destino, v.valor as viagem_valor, v.data_saida, v.data_retorno,
              u.nome as vendedor_nome,
              COALESCE(v.valor - COALESCE(r.desconto,0) + COALESCE(r.adicional,0), 0) as valor_final
       FROM reservas r
       LEFT JOIN viagens v ON r.viagem_id = v.id
       LEFT JOIN usuarios u ON r.vendedor_id = u.id
       ${where} ORDER BY r.created_at DESC LIMIT ? OFFSET ?`
    ).all(...params, Number(limit), offset);

    // Buscar passageiros de cada reserva
    const result = await Promise.all(reservas.map(async (r) => ({
      ...r,
      passageiros: await buscarPassageiros(r.id),
    })));

    res.json(result);
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

// Criar reserva
router.post('/', autenticar, async (req, res) => {
  try {
    const {
      viagem_id, desconto, adicional, forma_pagamento, tipo_cartao,
      num_parcelas, data_primeira_parcela, status, observacoes, passageiros = []
    } = req.body;
    if (!viagem_id) return res.status(400).json({ erro: 'Viagem obrigatória' });
    if (!forma_pagamento) return res.status(400).json({ erro: 'Forma de pagamento obrigatória' });
    if (passageiros.length === 0) return res.status(400).json({ erro: 'Adicione ao menos um passageiro' });

    const result = await db.prepare(
      `INSERT INTO reservas (viagem_id, vendedor_id, desconto, adicional, forma_pagamento, tipo_cartao,
        num_parcelas, data_primeira_parcela, status, observacoes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      viagem_id, req.usuario.id, desconto || 0, adicional || 0,
      forma_pagamento, tipo_cartao || null, num_parcelas || 1,
      data_primeira_parcela || null, status || 'pendente', observacoes || null
    );
    const reservaId = Number(result.lastInsertRowid);

    // Vincular passageiros
    for (const clienteId of passageiros) {
      await db.prepare('INSERT INTO reserva_passageiros (reserva_id, cliente_id) VALUES (?, ?)').run(reservaId, clienteId);
    }

    // Gerar parcelas se necessário
    if (data_primeira_parcela && num_parcelas > 1 &&
        (forma_pagamento === 'boleto' || (forma_pagamento === 'cartao' && tipo_cartao === 'credito'))) {
      await gerarParcelasReserva(reservaId, num_parcelas, data_primeira_parcela);
    }

    res.status(201).json({ id: reservaId, mensagem: 'Reserva criada com sucesso' });
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

// Editar reserva
router.put('/:id', autenticar, async (req, res) => {
  try {
    const reserva = await db.prepare('SELECT * FROM reservas WHERE id = ?').get(req.params.id);
    if (!reserva) return res.status(404).json({ erro: 'Reserva não encontrada' });
    if (req.usuario.tipo === 'vendedor' && reserva.vendedor_id !== req.usuario.id)
      return res.status(403).json({ erro: 'Sem permissão' });

    const {
      viagem_id, desconto, adicional, forma_pagamento, tipo_cartao,
      num_parcelas, data_primeira_parcela, status, observacoes, passageiros
    } = req.body;

    await db.prepare(
      `UPDATE reservas SET viagem_id=?, desconto=?, adicional=?, forma_pagamento=?, tipo_cartao=?,
        num_parcelas=?, data_primeira_parcela=?, status=?, observacoes=? WHERE id=?`
    ).run(
      viagem_id || reserva.viagem_id,
      desconto !== undefined ? desconto : reserva.desconto,
      adicional !== undefined ? adicional : reserva.adicional,
      forma_pagamento || reserva.forma_pagamento,
      tipo_cartao !== undefined ? tipo_cartao : reserva.tipo_cartao,
      num_parcelas || reserva.num_parcelas,
      data_primeira_parcela !== undefined ? data_primeira_parcela : reserva.data_primeira_parcela,
      status || reserva.status,
      observacoes !== undefined ? observacoes : reserva.observacoes,
      req.params.id
    );

    // Atualizar passageiros se enviados
    if (passageiros) {
      await db.prepare('DELETE FROM reserva_passageiros WHERE reserva_id = ?').run(req.params.id);
      for (const clienteId of passageiros) {
        await db.prepare('INSERT INTO reserva_passageiros (reserva_id, cliente_id) VALUES (?, ?)').run(req.params.id, clienteId);
      }
    }

    // Regenerar parcelas
    const fp = forma_pagamento || reserva.forma_pagamento;
    const tc = tipo_cartao !== undefined ? tipo_cartao : reserva.tipo_cartao;
    const np = num_parcelas || reserva.num_parcelas;
    const dp = data_primeira_parcela !== undefined ? data_primeira_parcela : reserva.data_primeira_parcela;
    if (dp && np > 1 && (fp === 'boleto' || (fp === 'cartao' && tc === 'credito'))) {
      await gerarParcelasReserva(Number(req.params.id), np, dp);
    }

    res.json({ mensagem: 'Reserva atualizada' });
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

// Deletar reserva
router.delete('/:id', autenticar, async (req, res) => {
  try {
    const reserva = await db.prepare('SELECT * FROM reservas WHERE id = ?').get(req.params.id);
    if (!reserva) return res.status(404).json({ erro: 'Reserva não encontrada' });
    if (req.usuario.tipo === 'vendedor' && reserva.vendedor_id !== req.usuario.id)
      return res.status(403).json({ erro: 'Sem permissão' });
    await db.prepare('DELETE FROM parcelas_reserva WHERE reserva_id = ?').run(req.params.id);
    await db.prepare('DELETE FROM reserva_passageiros WHERE reserva_id = ?').run(req.params.id);
    await db.prepare('DELETE FROM reservas WHERE id = ?').run(req.params.id);
    res.json({ mensagem: 'Reserva removida' });
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

// Mudar status
router.patch('/:id/status', autenticar, apenasAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['pendente', 'pago', 'cancelado'].includes(status)) return res.status(400).json({ erro: 'Status inválido' });
    await db.prepare('UPDATE reservas SET status = ? WHERE id = ?').run(status, req.params.id);
    res.json({ id: Number(req.params.id), status });
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

// Listar parcelas da reserva
router.get('/:id/parcelas', autenticar, async (req, res) => {
  try {
    const parcelas = await db.prepare('SELECT * FROM parcelas_reserva WHERE reserva_id = ? ORDER BY numero_parcela').all(req.params.id);
    res.json(parcelas);
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

// Marcar parcela como paga/não paga
router.patch('/parcelas/:id', autenticar, async (req, res) => {
  try {
    const { pago } = req.body;
    await db.prepare('UPDATE parcelas_reserva SET pago = ? WHERE id = ?').run(pago ? 1 : 0, req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

module.exports = router;
