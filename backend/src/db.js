const initSqlJs = require('sql.js');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

function getDbPath() {
  if (process.env.NODE_ENV === 'production') {
    const dataDir = '/data';
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    return path.join(dataDir, 'database.db');
  }
  return path.join(__dirname, '../database.db');
}
const DB_PATH = getDbPath();

let _db = null;

function saveDb() {
  const data = _db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

function rowsToObjects(columns, values) {
  return values.map((row) => {
    const obj = {};
    columns.forEach((col, i) => { obj[col] = row[i]; });
    return obj;
  });
}

function normalizeParams(args) {
  if (args.length === 1 && Array.isArray(args[0])) return args[0];
  return args;
}

class Statement {
  constructor(sql) {
    this._sql = sql;
  }

  get(...args) {
    const params = normalizeParams(args);
    const stmt = _db.prepare(this._sql);
    if (params.length) stmt.bind(params);
    const hasRow = stmt.step();
    const row = hasRow ? stmt.getAsObject() : undefined;
    stmt.free();
    return row;
  }

  all(...args) {
    const params = normalizeParams(args);
    const stmt = _db.prepare(this._sql);
    if (params.length) stmt.bind(params);
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    return rows;
  }

  run(...args) {
    const params = normalizeParams(args);
    _db.run(this._sql, params.length ? params : []);
    const res = _db.exec('SELECT last_insert_rowid()');
    const lastInsertRowid = res[0]?.values[0][0] ?? 0;
    saveDb();
    return { lastInsertRowid };
  }
}

const db = {
  prepare(sql) {
    return new Statement(sql);
  },
  exec(sql) {
    _db.run(sql);
    saveDb();
  },
};

async function initDb() {
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const buf = fs.readFileSync(DB_PATH);
    _db = new SQL.Database(buf);
  } else {
    _db = new SQL.Database();
  }

  _db.run(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      senha TEXT NOT NULL,
      tipo TEXT NOT NULL CHECK(tipo IN ('admin', 'vendedor')),
      status TEXT NOT NULL DEFAULT 'ativo' CHECK(status IN ('ativo', 'inativo')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS viagens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      destino TEXT NOT NULL,
      data_saida DATE NOT NULL,
      data_retorno DATE NOT NULL,
      valor REAL NOT NULL,
      descricao TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS clientes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      telefone TEXT NOT NULL,
      documento TEXT NOT NULL,
      destino TEXT NOT NULL,
      data_viagem DATE NOT NULL,
      viagem_id INTEGER,
      vendedor_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (viagem_id) REFERENCES viagens(id),
      FOREIGN KEY (vendedor_id) REFERENCES usuarios(id)
    );
  `);
  saveDb();

  const migracoes = [
    'ALTER TABLE clientes ADD COLUMN cpf TEXT',
    'ALTER TABLE clientes ADD COLUMN rg TEXT',
    'ALTER TABLE clientes ADD COLUMN data_nascimento DATE',
    'ALTER TABLE clientes ADD COLUMN desconto REAL DEFAULT 0',
    'ALTER TABLE clientes ADD COLUMN adicional REAL DEFAULT 0',
    'ALTER TABLE clientes ADD COLUMN observacoes TEXT',
    'ALTER TABLE clientes ADD COLUMN forma_pagamento TEXT DEFAULT NULL',
    'ALTER TABLE clientes ADD COLUMN tipo_cartao TEXT DEFAULT NULL',
    'ALTER TABLE clientes ADD COLUMN num_parcelas INTEGER DEFAULT 1',
    'ALTER TABLE clientes ADD COLUMN data_primeira_parcela DATE DEFAULT NULL',
    "ALTER TABLE clientes ADD COLUMN status TEXT NOT NULL DEFAULT 'pendente'",
  ];
  for (const sql of migracoes) {
    try { _db.run(sql); } catch (_) {}
  }

  _db.run(`
    CREATE TABLE IF NOT EXISTS parcelas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cliente_id INTEGER NOT NULL,
      numero_parcela INTEGER NOT NULL,
      data_vencimento DATE NOT NULL,
      pago INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE
    );
  `);
  saveDb();

  // Recriar clientes sem NOT NULL em documento (para suportar novos campos como obrigatorios)
  const tblInfo = _db.exec("PRAGMA table_info(clientes)");
  const cols = tblInfo[0]?.values || [];
  const docCol = cols.find((c) => c[1] === 'documento');
  if (docCol && docCol[3] === 1) {
    _db.run(`CREATE TABLE clientes_new (
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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (viagem_id) REFERENCES viagens(id),
      FOREIGN KEY (vendedor_id) REFERENCES usuarios(id)
    )`);
    _db.run(`INSERT INTO clientes_new SELECT id, nome, telefone, documento, cpf, rg, data_nascimento, destino, data_viagem, viagem_id, vendedor_id, COALESCE(desconto,0), COALESCE(adicional,0), observacoes, created_at FROM clientes`);
    _db.run('DROP TABLE clientes');
    _db.run('ALTER TABLE clientes_new RENAME TO clientes');
  }
  saveDb();

  const adminRes = _db.exec("SELECT id FROM usuarios WHERE tipo = 'admin'");
  if (!adminRes.length || !adminRes[0].values.length) {
    const senha = bcrypt.hashSync('admin123', 10);
    _db.run(
      'INSERT INTO usuarios (nome, email, senha, tipo) VALUES (?, ?, ?, ?)',
      ['Administrador', 'admin@penaestrada.com', senha, 'admin']
    );
    saveDb();
    console.log('Admin padrao criado: admin@penaestrada.com / admin123');
  }

  return db;
}

module.exports = { initDb, db };
