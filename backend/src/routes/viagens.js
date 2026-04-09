const express = require('express');
const { db } = require('../db');
const { autenticar, apenasAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/', autenticar, async (req, res) => {
  try {
    const isAdmin = req.usuario.tipo === 'admin';
    const viagens = isAdmin
      ? await db.prepare('SELECT * FROM viagens ORDER BY data_saida ASC').all()
      : await db.prepare('SELECT * FROM viagens WHERE oculto = 0 ORDER BY data_saida ASC').all();
    res.json(viagens);
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

router.patch('/:id/oculto', autenticar, apenasAdmin, async (req, res) => {
  try {
    const viagem = await db.prepare('SELECT * FROM viagens WHERE id = ?').get(req.params.id);
    if (!viagem) return res.status(404).json({ erro: 'Viagem não encontrada' });
    const novoStatus = viagem.oculto ? 0 : 1;
    await db.prepare('UPDATE viagens SET oculto = ? WHERE id = ?').run(novoStatus, req.params.id);
    const msg = novoStatus ? 'Viagem ocultada com sucesso' : 'Viagem reativada com sucesso';
    res.json({ id: Number(req.params.id), oculto: novoStatus, mensagem: msg });
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

router.post('/', autenticar, apenasAdmin, async (req, res) => {
  try {
    const { nome, destino, data_saida, data_retorno, valor, valor_compartilhado, valor_casal, descricao } = req.body;
    if (!nome || !destino || !data_saida || !data_retorno)
      return res.status(400).json({ erro: 'Campos obrigatórios: nome, destino, data_saida, data_retorno' });
    const vc = valor_compartilhado ?? valor ?? 0;
    const vca = valor_casal ?? 0;
    const result = await db.prepare(
      'INSERT INTO viagens (nome, destino, data_saida, data_retorno, valor, valor_compartilhado, valor_casal, descricao) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(nome, destino, data_saida, data_retorno, vc, vc, vca, descricao || '');
    res.status(201).json({ id: Number(result.lastInsertRowid), nome, destino, data_saida, data_retorno, valor: vc, valor_compartilhado: vc, valor_casal: vca, descricao });
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

router.put('/:id', autenticar, apenasAdmin, async (req, res) => {
  try {
    const viagem = await db.prepare('SELECT * FROM viagens WHERE id = ?').get(req.params.id);
    if (!viagem) return res.status(404).json({ erro: 'Viagem não encontrada' });
    const { nome, destino, data_saida, data_retorno, valor, valor_compartilhado, valor_casal, descricao } = req.body;
    const vc = valor_compartilhado ?? valor ?? viagem.valor_compartilhado ?? viagem.valor;
    const vca = valor_casal ?? viagem.valor_casal ?? 0;
    await db.prepare(
      'UPDATE viagens SET nome=?, destino=?, data_saida=?, data_retorno=?, valor=?, valor_compartilhado=?, valor_casal=?, descricao=? WHERE id=?'
    ).run(
      nome || viagem.nome, destino || viagem.destino,
      data_saida || viagem.data_saida, data_retorno || viagem.data_retorno,
      vc, vc, vca,
      descricao !== undefined ? descricao : viagem.descricao,
      req.params.id
    );
    res.json({ ...viagem, nome, destino, data_saida, data_retorno, valor: vc, valor_compartilhado: vc, valor_casal: vca, descricao, id: Number(req.params.id) });
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
