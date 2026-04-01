const { createClient } = require('@libsql/client');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

function resolveUrl() {
  const url = process.env.TURSO_URL || 'file:database.db';
  // Se for URL de arquivo local, garantir que o diretório existe
  if (url.startsWith('file:')) {
    const filePath = url.replace('file:', '');
    const dir = path.dirname(filePath);
    if (dir && dir !== '.' && !fs.existsSync(dir)) {
      try { fs.mkdirSync(dir, { recursive: true }); } catch (_) {}
    }
    // Fallback: se ainda não conseguir usar o caminho, usar pasta local
    try {
      fs.writeFileSync(filePath + '.test', ''); 
      fs.unlinkSync(filePath + '.test');
    } catch (_) {
      console.log('Fallback: usando database.db local');
      return 'file:database.db';
    }
  }
  return url;
}

let client;

function getClient() {
  if (client) return client;
  client = createClient({
    url: resolveUrl(),
    authToken: process.env.TURSO_AUTH_TOKEN || undefined,
  });
  return client;
}

// Wrapper que imita a API sincrona mas retorna promises
const db = {
  prepare(sql) {
    return {
      async get(...args) {
        const params = flatten(args);
        const r = await getClient().execute({ sql, args: params });
        return r.rows[0] || undefined;
      },
      async all(...args) {
        const params = flatten(args);
        const r = await getClient().execute({ sql, args: params });
        return r.rows;
      },
      async run(...args) {
        const params = flatten(args);
        const r = await getClient().execute({ sql, args: params });
        return { lastInsertRowid: r.lastInsertRowid };
      },
    };
  },
  async exec(sql) {
    await getClient().execute(sql);
  },
  async batch(sqls) {
    await getClient().batch(sqls.map(s => typeof s === 'string' ? { sql: s, args: [] } : s));
  },
};

function flatten(args) {
  if (args.length === 1 && Array.isArray(args[0])) return args[0];
  return args;
}

async function initDb() {
  const c = getClient();

  await c.batch([
    `CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      senha TEXT NOT NULL,
      tipo TEXT NOT NULL CHECK(tipo IN ('admin','vendedor')),
      status TEXT NOT NULL DEFAULT 'ativo' CHECK(status IN ('ativo','inativo')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS viagens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      destino TEXT NOT NULL,
      data_saida DATE NOT NULL,
      data_retorno DATE NOT NULL,
      valor REAL NOT NULL,
      descricao TEXT,
      oculto INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS clientes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      telefone TEXT NOT NULL,
      documento TEXT,
      cpf TEXT,
      rg TEXT,
      data_nascimento DATE,
      destino TEXT,
      data_viagem DATE,
      viagem_id INTEGER,
      vendedor_id INTEGER NOT NULL,
      desconto REAL DEFAULT 0,
      adicional REAL DEFAULT 0,
      observacoes TEXT,
      forma_pagamento TEXT DEFAULT NULL,
      tipo_cartao TEXT DEFAULT NULL,
      num_parcelas INTEGER DEFAULT 1,
      data_primeira_parcela DATE DEFAULT NULL,
      status TEXT NOT NULL DEFAULT 'pendente',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (viagem_id) REFERENCES viagens(id),
      FOREIGN KEY (vendedor_id) REFERENCES usuarios(id)
    )`,
    `CREATE TABLE IF NOT EXISTS parcelas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cliente_id INTEGER NOT NULL,
      numero_parcela INTEGER NOT NULL,
      data_vencimento DATE NOT NULL,
      pago INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS base_clientes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      cpf TEXT,
      rg TEXT,
      data_nascimento DATE,
      telefone TEXT,
      email TEXT,
      observacoes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS reservas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      viagem_id INTEGER NOT NULL,
      vendedor_id INTEGER NOT NULL,
      desconto REAL DEFAULT 0,
      adicional REAL DEFAULT 0,
      forma_pagamento TEXT,
      tipo_cartao TEXT,
      num_parcelas INTEGER DEFAULT 1,
      data_primeira_parcela DATE,
      status TEXT NOT NULL DEFAULT 'pendente',
      observacoes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (viagem_id) REFERENCES viagens(id),
      FOREIGN KEY (vendedor_id) REFERENCES usuarios(id)
    )`,
    `CREATE TABLE IF NOT EXISTS reserva_passageiros (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reserva_id INTEGER NOT NULL,
      cliente_id INTEGER NOT NULL,
      FOREIGN KEY (reserva_id) REFERENCES reservas(id) ON DELETE CASCADE,
      FOREIGN KEY (cliente_id) REFERENCES base_clientes(id)
    )`,
    `CREATE TABLE IF NOT EXISTS parcelas_reserva (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reserva_id INTEGER NOT NULL,
      numero_parcela INTEGER NOT NULL,
      data_vencimento DATE NOT NULL,
      pago INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (reserva_id) REFERENCES reservas(id) ON DELETE CASCADE
    )`,
  ], 'deferred');

  // Criar admin padrao se nao existir
  const admins = await c.execute("SELECT id FROM usuarios WHERE tipo = 'admin'");
  if (!admins.rows.length) {
    const senha = bcrypt.hashSync('admin123', 10);
    await c.execute({
      sql: 'INSERT INTO usuarios (nome, email, senha, tipo) VALUES (?, ?, ?, ?)',
      args: ['Administrador', 'admin@penaestrada.com', senha, 'admin'],
    });
    console.log('Admin padrao criado: admin@penaestrada.com / admin123');
  }

  return db;
}

module.exports = { initDb, db };
