const express = require('express');
const { db } = require('../db');
const { autenticar } = require('../middleware/auth');

const router = express.Router();

// GET /api/passageiros?viagem_id=X&busca=Y&status=Z
router.get('/', autenticar, async (req, res) => {
  try {
    const { viagem_id, busca, status } = req.query;
    const isAdmin = req.usuario.tipo === 'admin';

    let sql = `
      SELECT
        bc.id as cliente_id,
        bc.nome,
        bc.cpf,
        bc.rg,
        bc.data_nascimento,
        bc.telefone,
        bc.email,
        r.id as reserva_id,
        r.forma_pagamento,
        r.tipo_cartao,
        r.num_parcelas,
        r.status,
        r.desconto,
        r.adicional,
        u.nome as vendedor_nome,
        v.nome as viagem_nome,
        v.destino,
        v.data_saida,
        COALESCE(v.valor - COALESCE(r.desconto,0) + COALESCE(r.adicional,0), 0) as valor_final
      FROM reserva_passageiros rp
      JOIN base_clientes bc ON bc.id = rp.cliente_id
      JOIN reservas r ON r.id = rp.reserva_id
      JOIN viagens v ON v.id = r.viagem_id
      JOIN usuarios u ON u.id = r.vendedor_id
      WHERE 1=1
    `;
    const params = [];

    if (viagem_id) {
      sql += ' AND r.viagem_id = ?';
      params.push(viagem_id);
    }
    if (!isAdmin) {
      sql += ' AND r.vendedor_id = ?';
      params.push(req.usuario.id);
    }
    if (status) {
      sql += ' AND r.status = ?';
      params.push(status);
    }
    if (busca) {
      sql += ' AND (bc.nome LIKE ? OR bc.cpf LIKE ? OR bc.rg LIKE ?)';
      const b = `%${busca}%`;
      params.push(b, b, b);
    }

    sql += ' ORDER BY bc.nome ASC';

    const passageiros = await db.prepare(sql).all(...params);
    res.json(passageiros);
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

module.exports = router;
