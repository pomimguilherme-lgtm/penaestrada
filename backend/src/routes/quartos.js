const express = require('express');
const { db } = require('../db');
const { autenticar } = require('../middleware/auth');

const router = express.Router();

// Listar quartos de uma viagem (com pessoas)
router.get('/', autenticar, async (req, res) => {
  try {
    const { viagem_id } = req.query;
    if (!viagem_id) return res.status(400).json({ erro: 'viagem_id obrigatório' });

    const quartos = await db.prepare(
      'SELECT * FROM quartos WHERE viagem_id = ? ORDER BY nome ASC'
    ).all(viagem_id);

    for (const q of quartos) {
      q.pessoas = await db.prepare(
        'SELECT * FROM quarto_pessoas WHERE quarto_id = ? ORDER BY nome_pessoa ASC'
      ).all(q.id);
    }

    res.json(quartos);
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

// Criar quarto
router.post('/', autenticar, async (req, res) => {
  try {
    const { viagem_id, nome, capacidade } = req.body;
    if (!viagem_id || !nome) return res.status(400).json({ erro: 'viagem_id e nome são obrigatórios' });

    const r = await db.prepare(
      'INSERT INTO quartos (viagem_id, nome, capacidade) VALUES (?, ?, ?)'
    ).run(viagem_id, nome, capacidade || null);

    res.status(201).json({ id: Number(r.lastInsertRowid), viagem_id, nome, capacidade, pessoas: [] });
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

// Editar quarto
router.put('/:id', autenticar, async (req, res) => {
  try {
    const { nome, capacidade } = req.body;
    const q = await db.prepare('SELECT id FROM quartos WHERE id = ?').get(req.params.id);
    if (!q) return res.status(404).json({ erro: 'Quarto não encontrado' });
    await db.prepare('UPDATE quartos SET nome = ?, capacidade = ? WHERE id = ?')
      .run(nome, capacidade || null, req.params.id);
    res.json({ id: Number(req.params.id), nome, capacidade });
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

// Excluir quarto
router.delete('/:id', autenticar, async (req, res) => {
  try {
    const q = await db.prepare('SELECT id FROM quartos WHERE id = ?').get(req.params.id);
    if (!q) return res.status(404).json({ erro: 'Quarto não encontrado' });
    await db.prepare('DELETE FROM quartos WHERE id = ?').run(req.params.id);
    res.json({ mensagem: 'Quarto removido' });
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

// Adicionar pessoa ao quarto
router.post('/:id/pessoas', autenticar, async (req, res) => {
  try {
    const { nome_pessoa } = req.body;
    if (!nome_pessoa?.trim()) return res.status(400).json({ erro: 'Nome obrigatório' });
    const q = await db.prepare('SELECT id FROM quartos WHERE id = ?').get(req.params.id);
    if (!q) return res.status(404).json({ erro: 'Quarto não encontrado' });
    const r = await db.prepare(
      'INSERT INTO quarto_pessoas (quarto_id, nome_pessoa) VALUES (?, ?)'
    ).run(req.params.id, nome_pessoa.trim());
    res.status(201).json({ id: Number(r.lastInsertRowid), quarto_id: Number(req.params.id), nome_pessoa: nome_pessoa.trim() });
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

// Remover pessoa do quarto
router.delete('/pessoas/:id', autenticar, async (req, res) => {
  try {
    const p = await db.prepare('SELECT id FROM quarto_pessoas WHERE id = ?').get(req.params.id);
    if (!p) return res.status(404).json({ erro: 'Pessoa não encontrada' });
    await db.prepare('DELETE FROM quarto_pessoas WHERE id = ?').run(req.params.id);
    res.json({ mensagem: 'Pessoa removida' });
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

module.exports = router;
