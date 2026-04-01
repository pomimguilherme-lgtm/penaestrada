const express = require('express');
const { db } = require('../db');
const { autenticar } = require('../middleware/auth');

const router = express.Router();

// Listar clientes com busca
router.get('/', autenticar, async (req, res) => {
  try {
    const { busca } = req.query;
    let sql = 'SELECT * FROM base_clientes WHERE 1=1';
    const params = [];
    if (busca) {
      sql += ' AND (nome LIKE ? OR cpf LIKE ? OR rg LIKE ? OR telefone LIKE ? OR email LIKE ?)';
      const b = `%${busca}%`;
      params.push(b, b, b, b, b);
    }
    sql += ' ORDER BY nome ASC';
    const clientes = await db.prepare(sql).all(...params);
    res.json(clientes);
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

// Criar cliente
router.post('/', autenticar, async (req, res) => {
  try {
    const { nome, cpf, rg, data_nascimento, telefone, email, observacoes } = req.body;
    if (!nome) return res.status(400).json({ erro: 'Nome obrigatório' });
    const result = await db.prepare(
      'INSERT INTO base_clientes (nome, cpf, rg, data_nascimento, telefone, email, observacoes) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(nome, cpf || null, rg || null, data_nascimento || null, telefone || null, email || null, observacoes || null);
    res.status(201).json({ id: Number(result.lastInsertRowid), nome, cpf, rg, data_nascimento, telefone, email, observacoes });
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

// Editar cliente
router.put('/:id', autenticar, async (req, res) => {
  try {
    const c = await db.prepare('SELECT * FROM base_clientes WHERE id = ?').get(req.params.id);
    if (!c) return res.status(404).json({ erro: 'Cliente não encontrado' });
    const { nome, cpf, rg, data_nascimento, telefone, email, observacoes } = req.body;
    await db.prepare(
      'UPDATE base_clientes SET nome=?, cpf=?, rg=?, data_nascimento=?, telefone=?, email=?, observacoes=? WHERE id=?'
    ).run(
      nome || c.nome, cpf !== undefined ? cpf : c.cpf, rg !== undefined ? rg : c.rg,
      data_nascimento !== undefined ? data_nascimento : c.data_nascimento,
      telefone !== undefined ? telefone : c.telefone, email !== undefined ? email : c.email,
      observacoes !== undefined ? observacoes : c.observacoes, req.params.id
    );
    res.json({ ...c, ...req.body, id: Number(req.params.id) });
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

// Deletar cliente (só se não tiver reservas)
router.delete('/:id', autenticar, async (req, res) => {
  try {
    const c = await db.prepare('SELECT * FROM base_clientes WHERE id = ?').get(req.params.id);
    if (!c) return res.status(404).json({ erro: 'Cliente não encontrado' });
    const reservas = await db.prepare('SELECT COUNT(*) as total FROM reserva_passageiros WHERE cliente_id = ?').get(req.params.id);
    if (reservas?.total > 0) return res.status(400).json({ erro: 'Cliente possui reservas vinculadas. Remova-o das reservas primeiro.' });
    await db.prepare('DELETE FROM base_clientes WHERE id = ?').run(req.params.id);
    res.json({ mensagem: 'Cliente removido' });
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

module.exports = router;
