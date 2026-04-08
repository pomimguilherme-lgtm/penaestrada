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

// ─── Multer (carregado dinamicamente para não crashar) ────────────────────────
let upload;
try {
  const multer = require('multer');
  const { v4: uuidv4 } = require('uuid');

  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${uuidv4()}${ext}`);
    },
  });

  const tiposPermitidos = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/quicktime'];

  upload = multer({
    storage,
    limits: { fileSize: 100 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      if (tiposPermitidos.includes(file.mimetype)) cb(null, true);
      else cb(new Error('Tipo não permitido'));
    },
  });
} catch (e) {
  console.error('multer/uuid não disponível:', e.message);
}

// ─── Listar mídias ───────────────────────────────────────────────────────────
router.get('/:viagem_id', autenticar, async (req, res) => {
  try {
    const midias = await db.prepare(
      `SELECT vm.*, u.nome as uploaded_por_nome
       FROM viagem_midias vm
       LEFT JOIN usuarios u ON u.id = vm.uploaded_por
       WHERE vm.viagem_id = ?
       ORDER BY vm.created_at DESC`
    ).all(req.params.viagem_id);
    res.json(midias);
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

// ─── Upload ──────────────────────────────────────────────────────────────────
router.post('/:viagem_id/upload', autenticar, apenasAdmin, (req, res, next) => {
  if (!upload) return res.status(503).json({ erro: 'Upload não disponível no servidor' });
  upload.array('midias', 20)(req, res, next);
}, async (req, res) => {
  try {
    const { viagem_id } = req.params;
    const viagem = await db.prepare('SELECT id FROM viagens WHERE id = ?').get(viagem_id);
    if (!viagem) return res.status(404).json({ erro: 'Viagem não encontrada' });
    if (!req.files || req.files.length === 0) return res.status(400).json({ erro: 'Nenhum arquivo enviado' });

    const backendUrl = process.env.BACKEND_URL ||
      `https://penaestrada-backend-production-8520.up.railway.app`;

    const inseridas = [];
    for (const file of req.files) {
      const tipo = file.mimetype.startsWith('video') ? 'video' : 'imagem';
      const url = `${backendUrl}/uploads/${file.filename}`;
      const result = await db.prepare(
        'INSERT INTO viagem_midias (viagem_id, tipo, nome_arquivo, url, tamanho, uploaded_por) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(viagem_id, tipo, file.filename, url, file.size, req.usuario.id);
      inseridas.push({ id: Number(result.lastInsertRowid), tipo, url, nome_arquivo: file.filename });
    }

    res.status(201).json(inseridas);
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

// ─── Excluir ─────────────────────────────────────────────────────────────────
router.delete('/:id', autenticar, apenasAdmin, async (req, res) => {
  try {
    const midia = await db.prepare('SELECT * FROM viagem_midias WHERE id = ?').get(req.params.id);
    if (!midia) return res.status(404).json({ erro: 'Mídia não encontrada' });

    try { fs.unlinkSync(path.join(uploadsDir, midia.nome_arquivo)); } catch (_) {}

    await db.prepare('DELETE FROM viagem_midias WHERE id = ?').run(req.params.id);
    res.json({ mensagem: 'Mídia removida' });
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

module.exports = { router, uploadsDir };
