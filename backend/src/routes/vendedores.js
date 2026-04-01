const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../db');
const { autenticar, apenasAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/', autenticar, apenasAdmin, (req, res) => {
  const vendedores = db.prepare('SELECT id, nome, email, status, created_at FROM usuarios WHERE tipo = ?').all('vendedor');
  res.json(vendedores);
});

router.post('/', autenticar, apenasAdmin, (req, res) => {
  const { nome, email, senha, status = 'ativo' } = req.body;
  if (!nome || !email || !senha) return res.status(400).json({ erro: 'Nome, email e senha obrigatórios' });

  const existe = db.prepare('SELECT id FROM usuarios WHERE email = ?').get(email);
  if (existe) return res.status(400).json({ erro: 'Email já cadastrado' });

  const hash = bcrypt.hashSync(senha, 10);
  const result = db.prepare('INSERT INTO usuarios (nome, email, senha, tipo, status) VALUES (?, ?, ?, ?, ?)').run(nome, email, hash, 'vendedor', status);
  res.status(201).json({ id: result.lastInsertRowid, nome, email, tipo: 'vendedor', status });
});

router.put('/:id', autenticar, apenasAdmin, (req, res) => {
  const { nome, email, senha, status } = req.body;
  const vendedor = db.prepare('SELECT * FROM usuarios WHERE id = ? AND tipo = ?').get(req.params.id, 'vendedor');
  if (!vendedor) return res.status(404).json({ erro: 'Vendedor não encontrado' });

  const novoNome = nome || vendedor.nome;
  const novoEmail = email || vendedor.email;
  const novoStatus = status || vendedor.status;

  if (email && email !== vendedor.email) {
    const existe = db.prepare('SELECT id FROM usuarios WHERE email = ? AND id != ?').get(email, req.params.id);
    if (existe) return res.status(400).json({ erro: 'Email já em uso' });
  }

  if (senha) {
    const hash = bcrypt.hashSync(senha, 10);
    db.prepare('UPDATE usuarios SET nome = ?, email = ?, senha = ?, status = ? WHERE id = ?').run(novoNome, novoEmail, hash, novoStatus, req.params.id);
  } else {
    db.prepare('UPDATE usuarios SET nome = ?, email = ?, status = ? WHERE id = ?').run(novoNome, novoEmail, novoStatus, req.params.id);
  }

  res.json({ id: Number(req.params.id), nome: novoNome, email: novoEmail, tipo: 'vendedor', status: novoStatus });
});

router.delete('/:id', autenticar, apenasAdmin, (req, res) => {
  const vendedor = db.prepare('SELECT id FROM usuarios WHERE id = ? AND tipo = ?').get(req.params.id, 'vendedor');
  if (!vendedor) return res.status(404).json({ erro: 'Vendedor não encontrado' });
  db.prepare('DELETE FROM usuarios WHERE id = ?').run(req.params.id);
  res.json({ mensagem: 'Vendedor removido' });
});

module.exports = router;

