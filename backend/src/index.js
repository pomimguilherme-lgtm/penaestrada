const express = require('express');
const cors = require('cors');
const { initDb } = require('./db');

const app = express();
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok', env: process.env.NODE_ENV }));

// Backup do banco — protegido por token secreto
app.get('/backup/database', (req, res) => {
  const token = req.query.token;
  const secret = process.env.BACKUP_SECRET || 'penaestrada-backup-2024';
  if (token !== secret) return res.status(401).json({ erro: 'Nao autorizado' });

  const fs = require('fs');
  const path = require('path');
  const dbUrl = process.env.TURSO_URL || 'file:database.db';
  const dbPath = dbUrl.startsWith('file:') ? dbUrl.replace('file:', '') : 'database.db';
  const absPath = path.isAbsolute(dbPath) ? dbPath : path.join(__dirname, '..', dbPath);

  if (!fs.existsSync(absPath)) return res.status(404).json({ erro: 'Arquivo nao encontrado' });

  const date = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Disposition', `attachment; filename="penaestrada-backup-${date}.db"`);
  res.setHeader('Content-Type', 'application/octet-stream');
  fs.createReadStream(absPath).pipe(res);
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/vendedores', require('./routes/vendedores'));
app.use('/api/viagens', require('./routes/viagens'));
app.use('/api/clientes', require('./routes/clientes'));
app.use('/api/parcelas', require('./routes/parcelas').router);
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/base-clientes', require('./routes/base-clientes'));
app.use('/api/reservas', require('./routes/reservas'));

const PORT = process.env.PORT || 3001;

initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
  });
}).catch((err) => {
  console.error('Erro ao inicializar banco de dados:', err);
  process.exit(1);
});
