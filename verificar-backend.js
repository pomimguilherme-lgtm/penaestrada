const https = require('https');

function get(path) {
  return new Promise((resolve, reject) => {
    https.get(`https://penaestrada-backend.onrender.com${path}`, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: d.slice(0, 200) }));
    }).on('error', reject);
  });
}

async function main() {
  console.log('Verificando rotas do backend em producao...\n');
  for (const path of ['/', '/api', '/api/auth/login', '/api/viagens', '/api/dashboard']) {
    try {
      const r = await get(path);
      console.log(`${r.status === 200 ? '✅' : r.status === 404 ? '❌' : '⚠️ '} ${path} → HTTP ${r.status} | ${r.body.slice(0, 80)}`);
    } catch(e) {
      console.log(`💥 ${path} → Erro: ${e.message}`);
    }
  }
}

main();
