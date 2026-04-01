const express = require('express');
const { db } = require('../db');
const { autenticar, apenasAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/', autenticar, (req, res) => {
  const viagens = db.prepare('SELECT * FROM viagens ORDER BY data_saida ASC').all();
  res.json(viagens);
});

router.post('/', autenticar, apenasAdmin, (req, res) => {
  const { nome, destino, data_saida, data_retorno, valor, descricao } = req.body;
  if (!nome || !destino || !data_saida || !data_retorno || valor === undefined) {
    return res.status(400).json({ erro: 'Campos obrigatórios: nome, destino, data_saida, data_retorno, valor' });
  }
  const result = db.prepare('INSERT INTO viagens (nome, destino, data_saida, data_retorno, valor, descricao) VALUES (?, ?, ?, ?, ?, ?)').run(nome, destino, data_saida, data_retorno, valor, descricao || '');
  res.status(201).json({ id: result.lastInsertRowid, nome, destino, data_saida, data_retorno, valor, descricao });
});

router.put('/:id', autenticar, apenasAdmin, (req, res) => {
  const viagem = db.prepare('SELECT * FROM viagens WHERE id = ?').get(req.params.id);
  if (!viagem) return res.status(404).json({ erro: 'Viagem não encontrada' });

  const { nome, destino, data_saida, data_retorno, valor, descricao } = req.body;
  db.prepare('UPDATE viagens SET nome = ?, destino = ?, data_saida = ?, data_retorno = ?, valor = ?, descricao = ? WHERE id = ?').run(
    nome || viagem.nome,
    destino || viagem.destino,
    data_saida || viagem.data_saida,
    data_retorno || viagem.data_retorno,
    valor !== undefined ? valor : viagem.valor,
    descricao !== undefined ? descricao : viagem.descricao,
    req.params.id
  );
  res.json({ ...viagem, ...req.body, id: Number(req.params.id) });
});

router.delete('/:id', autenticar, apenasAdmin, (req, res) => {
  const viagem = db.prepare('SELECT id FROM viagens WHERE id = ?').get(req.params.id);
  if (!viagem) return res.status(404).json({ erro: 'Viagem não encontrada' });
  db.prepare('DELETE FROM viagens WHERE id = ?').run(req.params.id);
  res.json({ mensagem: 'Viagem removida' });
});

module.exports = router;

