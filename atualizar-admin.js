const http = require('http');
const bcrypt = require('./backend/node_modules/bcryptjs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'backend/database.db');

async function main() {
  const initSqlJs = require('./backend/node_modules/sql.js');
  const fs = require('fs');
  const SQL = await initSqlJs();

  const buf = fs.readFileSync(DB_PATH);
  const db = new SQL.Database(buf);

  const novoEmail = 'sabrina.pomim@penaestrada.com';
  const novaSenha = '10Brasilsul';
  const hash = bcrypt.hashSync(novaSenha, 10);

  db.run("UPDATE usuarios SET email = ?, senha = ? WHERE tipo = 'admin'", [novoEmail, hash]);

  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));

  console.log('Admin atualizado com sucesso!');
  console.log('  Email:', novoEmail);
  console.log('  Senha: (criptografada)');
}

main().catch(console.error);
