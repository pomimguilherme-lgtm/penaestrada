const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../db');
const { autenticar, apenasAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/', autenticar, apenasAdmin, async (req, res) => {
  try {
    const todos = await db.prepare('SELECT id, nome, email, tipo, status, created_at FROM usuarios ORDER BY tipo ASC, nome ASC').all();
    res.json(todos);
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

router.post('/', autenticar, apenasAdmin, async (req, res) => {
  try {
    const { nome, email, senha, status = 'ativo' } = req.body;
    if (!nome || !email || !senha) return res.status(400).json({ erro: 'Nome, email e senha obrigatórios' });
    const existe = await db.prepare('SELECT id FROM usuarios WHERE email = ?').get(email);
    if (existe) return res.status(400).json({ erro: 'Email já cadastrado' });
    const hash = bcrypt.hashSync(senha, 10);
    const result = await db.prepare('INSERT INTO usuarios (nome, email, senha, tipo, status) VALUES (?, ?, ?, ?, ?)').run(nome, email, hash, 'vendedor', status);
    res.status(201).json({ id: Number(result.lastInsertRowid), nome, email, tipo: 'vendedor', status });
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

router.put('/:id', autenticar, apenasAdmin, async (req, res) => {
  try {
    const { nome, email, senha, status } = req.body;
    const usuario = await db.prepare('SELECT * FROM usuarios WHERE id = ?').get(req.params.id);
    if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado' });
    // Impede admin de remover a si mesmo
    if (Number(req.params.id) === req.usuario.id && status === 'inativo')
      return res.status(400).json({ erro: 'Você não pode desativar sua própria conta' });
    const novoNome = nome || usuario.nome;
    const novoEmail = email || usuario.email;
    const novoStatus = status || usuario.status;
    if (email && email !== usuario.email) {
      const existe = await db.prepare('SELECT id FROM usuarios WHERE email = ? AND id != ?').get(email, req.params.id);
      if (existe) return res.status(400).json({ erro: 'Email já em uso' });
    }
    if (senha) {
      const hash = bcrypt.hashSync(senha, 10);
      await db.prepare('UPDATE usuarios SET nome = ?, email = ?, senha = ?, status = ? WHERE id = ?').run(novoNome, novoEmail, hash, novoStatus, req.params.id);
    } else {
      await db.prepare('UPDATE usuarios SET nome = ?, email = ?, status = ? WHERE id = ?').run(novoNome, novoEmail, novoStatus, req.params.id);
    }
    res.json({ id: Number(req.params.id), nome: novoNome, email: novoEmail, tipo: usuario.tipo, status: novoStatus });
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

// Alterar tipo (admin <-> vendedor) — apenas admin, não pode mudar a si mesmo
router.patch('/:id/tipo', autenticar, apenasAdmin, async (req, res) => {
  try {
    if (Number(req.params.id) === req.usuario.id)
      return res.status(400).json({ erro: 'Você não pode alterar sua própria permissão' });
    const usuario = await db.prepare('SELECT * FROM usuarios WHERE id = ?').get(req.params.id);
    if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado' });
    const novoTipo = usuario.tipo === 'admin' ? 'vendedor' : 'admin';
    await db.prepare('UPDATE usuarios SET tipo = ? WHERE id = ?').run(novoTipo, req.params.id);
    const msg = novoTipo === 'admin'
      ? 'Usuário definido como administrador com sucesso'
      : 'Permissão de administrador removida com sucesso';
    res.json({ id: Number(req.params.id), tipo: novoTipo, mensagem: msg });
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

router.delete('/:id', autenticar, apenasAdmin, async (req, res) => {
  try {
    const vendedor = await db.prepare('SELECT id FROM usuarios WHERE id = ? AND tipo = ?').get(req.params.id, 'vendedor');
    if (!vendedor) return res.status(404).json({ erro: 'Vendedor não encontrado' });
    await db.prepare('DELETE FROM usuarios WHERE id = ?').run(req.params.id);
    res.json({ mensagem: 'Vendedor removido' });
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

module.exports = router;
