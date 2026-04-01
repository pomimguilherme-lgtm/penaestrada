const express = require('express');
const cors = require('cors');
const { initDb } = require('./db');

const app = express();
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());

app.use('/api/auth', require('./routes/auth'));
app.use('/api/vendedores', require('./routes/vendedores'));
app.use('/api/viagens', require('./routes/viagens'));
app.use('/api/clientes', require('./routes/clientes'));
app.use('/api/parcelas', require('./routes/parcelas').router);
app.use('/api/dashboard', require('./routes/dashboard'));

const PORT = process.env.PORT || 3001;

initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
  });
}).catch((err) => {
  console.error('Erro ao inicializar banco de dados:', err);
  process.exit(1);
});
