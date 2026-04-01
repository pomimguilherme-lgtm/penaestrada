const http = require('http');

function request(options, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(body || {});
    const opts = {
      hostname: 'localhost',
      port: 3001,
      method: options.method || 'GET',
      path: options.path,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr),
        ...options.headers,
      },
    };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

async function main() {
  const login = await request(
    { method: 'POST', path: '/api/auth/login' },
    { email: 'admin@penaestrada.com', senha: 'admin123' }
  );
  const token = login.token;
  const headers = { Authorization: 'Bearer ' + token };

  const vendedores = await request({ method: 'GET', path: '/api/vendedores', headers }, {});
  console.log('Vendedores existentes:', JSON.stringify(vendedores, null, 2));

  const novoVendedor = await request(
    { method: 'POST', path: '/api/vendedores', headers },
    { nome: 'Ana Vendedora', email: 'ana@penaestrada.com', senha: 'vendedor123', status: 'ativo' }
  );
  console.log('Resultado:', JSON.stringify(novoVendedor, null, 2));
}

main().catch(console.error);
