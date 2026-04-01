const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../db');
const { SECRET } = require('../middleware/auth');

const router = express.Router();

router.post('/login', async (req, res) => {
  try {
    const { email, senha } = req.body;
    if (!email || !senha) return res.status(400).json({ erro: 'Email e senha obrigatórios' });

    const usuario = await db.prepare('SELECT * FROM usuarios WHERE email = ? AND status = ?').get(email, 'ativo');
    if (!usuario) return res.status(401).json({ erro: 'Credenciais inválidas' });

    const senhaValida = bcrypt.compareSync(senha, usuario.senha);
    if (!senhaValida) return res.status(401).json({ erro: 'Credenciais inválidas' });

    const token = jwt.sign(
      { id: usuario.id, nome: usuario.nome, email: usuario.email, tipo: usuario.tipo },
      SECRET,
      { expiresIn: '8h' }
    );
    res.json({ token, usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email, tipo: usuario.tipo } });
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

// Setup inicial — só funciona se email ainda for admin@penaestrada.com
router.post('/setup-admin', async (req, res) => {
  try {
    const { nome, email, senha } = req.body;
    const admin = await db.prepare("SELECT * FROM usuarios WHERE email = 'admin@penaestrada.com' AND tipo = 'admin'").get();
    if (!admin) return res.status(400).json({ erro: 'Setup já realizado ou admin não encontrado' });
    const hash = bcrypt.hashSync(senha, 10);
    await db.prepare('UPDATE usuarios SET nome = ?, email = ?, senha = ? WHERE id = ?').run(nome, email, hash, admin.id);
    res.json({ ok: true, mensagem: 'Admin atualizado com sucesso' });
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

module.exports = router;
