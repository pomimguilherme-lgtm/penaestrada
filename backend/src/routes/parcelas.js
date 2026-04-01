const express = require('express');
const { db } = require('../db');
const { autenticar } = require('../middleware/auth');

const router = express.Router();

// Gerar parcelas automaticamente (boleto ou credito)
function gerarParcelas(clienteId, numParcelas, dataPrimeira) {
  db.prepare('DELETE FROM parcelas WHERE cliente_id = ?').run(clienteId);
  const base = new Date(dataPrimeira + 'T12:00:00');
  for (let i = 0; i < numParcelas; i++) {
    const d = new Date(base);
    d.setMonth(d.getMonth() + i);
    const iso = d.toISOString().split('T')[0];
    db.prepare('INSERT INTO parcelas (cliente_id, numero_parcela, data_vencimento) VALUES (?, ?, ?)').run(clienteId, i + 1, iso);
  }
}

// Buscar parcelas de um cliente
router.get('/:clienteId', autenticar, (req, res) => {
  const parcelas = db.prepare('SELECT * FROM parcelas WHERE cliente_id = ? ORDER BY numero_parcela').all(req.params.clienteId);
  res.json(parcelas);
});

// Marcar parcela como paga/nao paga
router.patch('/:id', autenticar, (req, res) => {
  const { pago } = req.body;
  const parcela = db.prepare('SELECT * FROM parcelas WHERE id = ?').get(req.params.id);
  if (!parcela) return res.status(404).json({ erro: 'Parcela nao encontrada' });
  db.prepare('UPDATE parcelas SET pago = ? WHERE id = ?').run(pago ? 1 : 0, req.params.id);
  res.json({ ...parcela, pago: pago ? 1 : 0 });
});

module.exports = { router, gerarParcelas };
