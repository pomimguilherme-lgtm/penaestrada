const express = require('express');
const { db } = require('../db');
const { autenticar } = require('../middleware/auth');

const router = express.Router();

async function gerarParcelas(clienteId, numParcelas, dataPrimeira) {
  await db.prepare('DELETE FROM parcelas WHERE cliente_id = ?').run(clienteId);
  const base = new Date(dataPrimeira + 'T12:00:00');
  for (let i = 0; i < numParcelas; i++) {
    const d = new Date(base);
    d.setMonth(d.getMonth() + i);
    const iso = d.toISOString().split('T')[0];
    await db.prepare('INSERT INTO parcelas (cliente_id, numero_parcela, data_vencimento) VALUES (?, ?, ?)').run(clienteId, i + 1, iso);
  }
}

router.get('/:clienteId', autenticar, async (req, res) => {
  try {
    const parcelas = await db.prepare('SELECT * FROM parcelas WHERE cliente_id = ? ORDER BY numero_parcela').all(req.params.clienteId);
    res.json(parcelas);
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

router.patch('/:id', autenticar, async (req, res) => {
  try {
    const { pago } = req.body;
    const parcela = await db.prepare('SELECT * FROM parcelas WHERE id = ?').get(req.params.id);
    if (!parcela) return res.status(404).json({ erro: 'Parcela nao encontrada' });
    await db.prepare('UPDATE parcelas SET pago = ? WHERE id = ?').run(pago ? 1 : 0, req.params.id);
    res.json({ ...parcela, pago: pago ? 1 : 0 });
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

module.exports = { router, gerarParcelas };
