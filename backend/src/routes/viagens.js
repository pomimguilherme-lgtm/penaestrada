const express = require('express');
const { db } = require('../db');
const { autenticar, apenasAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/', autenticar, async (req, res) => {
  try {
    const viagens = await db.prepare('SELECT * FROM viagens ORDER BY data_saida ASC').all();
    res.json(viagens);
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

router.post('/', autenticar, apenasAdmin, async (req, res) => {
  try {
    const { nome, destino, data_saida, data_retorno, valor, descricao } = req.body;
    if (!nome || !destino || !data_saida || !data_retorno || valor === undefined)
      return res.status(400).json({ erro: 'Campos obrigatórios: nome, destino, data_saida, data_retorno, valor' });
    const result = await db.prepare('INSERT INTO viagens (nome, destino, data_saida, data_retorno, valor, descricao) VALUES (?, ?, ?, ?, ?, ?)').run(nome, destino, data_saida, data_retorno, valor, descricao || '');
    res.status(201).json({ id: Number(result.lastInsertRowid), nome, destino, data_saida, data_retorno, valor, descricao });
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

router.put('/:id', autenticar, apenasAdmin, async (req, res) => {
  try {
    const viagem = await db.prepare('SELECT * FROM viagens WHERE id = ?').get(req.params.id);
    if (!viagem) return res.status(404).json({ erro: 'Viagem não encontrada' });
    const { nome, destino, data_saida, data_retorno, valor, descricao } = req.body;
    await db.prepare('UPDATE viagens SET nome=?, destino=?, data_saida=?, data_retorno=?, valor=?, descricao=? WHERE id=?').run(
      nome || viagem.nome, destino || viagem.destino,
      data_saida || viagem.data_saida, data_retorno || viagem.data_retorno,
      valor !== undefined ? valor : viagem.valor,
      descricao !== undefined ? descricao : viagem.descricao,
      req.params.id
    );
    res.json({ ...viagem, ...req.body, id: Number(req.params.id) });
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

router.delete('/:id', autenticar, apenasAdmin, async (req, res) => {
  try {
    const viagem = await db.prepare('SELECT id FROM viagens WHERE id = ?').get(req.params.id);
    if (!viagem) return res.status(404).json({ erro: 'Viagem não encontrada' });
    await db.prepare('DELETE FROM viagens WHERE id = ?').run(req.params.id);
    res.json({ mensagem: 'Viagem removida' });
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

module.exports = router;
