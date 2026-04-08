const express = require('express');
const path = require('path');
const fs = require('fs');
const { db } = require('../db');
const { autenticar, apenasAdmin } = require('../middleware/auth');

const router = express.Router();

// ─── Pasta de uploads ────────────────────────────────────────────────────────
function resolveUploadsDir() {
  const candidates = ['/data/uploads', path.join(__dirname, '../../uploads')];
  for (const dir of candidates) {
    try {
      fs.mkdirSync(dir, { recursive: true });
      const test = path.join(dir, '.test');
      fs.writeFileSync(test, '');
      fs.unlinkSync(test);
      return dir;
    } catch (_) {}
  }
  const fallback = path.join(__dirname, '../../uploads');
  fs.mkdirSync(fallback, { recursive: true });
  return fallback;
}

const uploadsDir = resolveUploadsDir();

// ─── Multer ───────────────────────────────────────────────────────────────────
let upload;
try {
  const multer = require('multer');
  const { v4: uuidv4 } = require('uuid');
  upload = multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => cb(null, uploadsDir),
      filename: (req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname).toLowerCase()}`),
    }),
    limits: { fileSize: 100 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      const ok = ['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/quicktime'];
      cb(ok.includes(file.mimetype) ? null : new Error('Tipo não permitido'), ok.includes(file.mimetype));
    },
  });
} catch (e) { console.error('multer/uuid indisponível:', e.message); }

// ─── CRUD Galerias ────────────────────────────────────────────────────────────

// Listar todas
router.get('/', autenticar, async (req, res) => {
  try {
    const galerias = await db.prepare(
      `SELECT g.*, u.nome as criado_por_nome,
              COUNT(gm.id) as total_midias
       FROM galerias g
       LEFT JOIN usuarios u ON u.id = g.created_by
       LEFT JOIN galeria_midias gm ON gm.galeria_id = g.id
       GROUP BY g.id
       ORDER BY g.created_at DESC`
    ).all();
    res.json(galerias);
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

// Criar galeria (admin)
router.post('/', autenticar, apenasAdmin, async (req, res) => {
  try {
    const { nome, data, descricao } = req.body;
    if (!nome) return res.status(400).json({ erro: 'Nome obrigatório' });
    const r = await db.prepare(
      'INSERT INTO galerias (nome, data, descricao, created_by) VALUES (?, ?, ?, ?)'
    ).run(nome, data || null, descricao || null, req.usuario.id);
    res.status(201).json({ id: Number(r.lastInsertRowid), nome, data, descricao });
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

// Editar galeria (admin)
router.put('/:id', autenticar, apenasAdmin, async (req, res) => {
  try {
    const { nome, data, descricao } = req.body;
    const g = await db.prepare('SELECT id FROM galerias WHERE id = ?').get(req.params.id);
    if (!g) return res.status(404).json({ erro: 'Galeria não encontrada' });
    await db.prepare('UPDATE galerias SET nome=?, data=?, descricao=? WHERE id=?')
      .run(nome, data || null, descricao || null, req.params.id);
    res.json({ id: Number(req.params.id), nome, data, descricao });
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

// Excluir galeria (admin)
router.delete('/:id', autenticar, apenasAdmin, async (req, res) => {
  try {
    const g = await db.prepare('SELECT id FROM galerias WHERE id = ?').get(req.params.id);
    if (!g) return res.status(404).json({ erro: 'Galeria não encontrada' });
    // Apagar arquivos do disco
    const midias = await db.prepare('SELECT nome_arquivo FROM galeria_midias WHERE galeria_id = ?').all(req.params.id);
    for (const m of midias) {
      try { fs.unlinkSync(path.join(uploadsDir, m.nome_arquivo)); } catch (_) {}
    }
    await db.prepare('DELETE FROM galerias WHERE id = ?').run(req.params.id);
    res.json({ mensagem: 'Galeria removida' });
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

// ─── Mídias ───────────────────────────────────────────────────────────────────

// Listar mídias de uma galeria
router.get('/:id/midias', autenticar, async (req, res) => {
  try {
    const midias = await db.prepare(
      `SELECT gm.*, u.nome as uploaded_por_nome
       FROM galeria_midias gm
       LEFT JOIN usuarios u ON u.id = gm.uploaded_por
       WHERE gm.galeria_id = ?
       ORDER BY gm.created_at DESC`
    ).all(req.params.id);
    res.json(midias);
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

// Upload de mídias (admin)
router.post('/:id/upload', autenticar, apenasAdmin, (req, res, next) => {
  if (!upload) return res.status(503).json({ erro: 'Upload indisponível no servidor' });
  upload.array('midias', 30)(req, res, next);
}, async (req, res) => {
  try {
    const g = await db.prepare('SELECT id FROM galerias WHERE id = ?').get(req.params.id);
    if (!g) return res.status(404).json({ erro: 'Galeria não encontrada' });
    if (!req.files?.length) return res.status(400).json({ erro: 'Nenhum arquivo enviado' });

    const backendUrl = process.env.BACKEND_URL || 'https://penaestrada-backend-production-8520.up.railway.app';
    const inseridas = [];
    for (const file of req.files) {
      const tipo = file.mimetype.startsWith('video') ? 'video' : 'imagem';
      const url = `${backendUrl}/uploads/${file.filename}`;
      const r = await db.prepare(
        'INSERT INTO galeria_midias (galeria_id, tipo, nome_arquivo, url, tamanho, uploaded_por) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(req.params.id, tipo, file.filename, url, file.size, req.usuario.id);
      inseridas.push({ id: Number(r.lastInsertRowid), tipo, url, nome_arquivo: file.filename });
    }
    res.status(201).json(inseridas);
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

// Excluir mídia (admin)
router.delete('/midia/:id', autenticar, apenasAdmin, async (req, res) => {
  try {
    const m = await db.prepare('SELECT * FROM galeria_midias WHERE id = ?').get(req.params.id);
    if (!m) return res.status(404).json({ erro: 'Mídia não encontrada' });
    try { fs.unlinkSync(path.join(uploadsDir, m.nome_arquivo)); } catch (_) {}
    await db.prepare('DELETE FROM galeria_midias WHERE id = ?').run(req.params.id);
    res.json({ mensagem: 'Mídia removida' });
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

module.exports = { router, uploadsDir };
