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
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(data) }));
    });
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

async function main() {
  console.log('--- Testando login da Ana ---\n');

  const res = await request(
    { method: 'POST', path: '/api/auth/login' },
    { email: 'ana@penaestrada.com', senha: 'vendedor123' }
  );

  if (res.status !== 200) {
    console.log('FALHOU:', res.body);
    return;
  }

  const { token, usuario } = res.body;
  console.log('Login OK!');
  console.log('  Nome:', usuario.nome);
  console.log('  Email:', usuario.email);
  console.log('  Tipo:', usuario.tipo);
  console.log('  Token:', token.substring(0, 40) + '...');

  const h = { Authorization: 'Bearer ' + token };

  const clientes = await request({ method: 'GET', path: '/api/clientes', headers: h }, {});
  console.log('\nClientes visiveis para a Ana:', clientes.body.length);
  clientes.body.forEach(c => console.log('  -', c.nome, '|', c.destino));

  const viagens = await request({ method: 'GET', path: '/api/viagens', headers: h }, {});
  console.log('\nViagens disponiveis:', viagens.body.length);
  viagens.body.forEach(v => console.log('  -', v.nome));

  const vendRes = await request({ method: 'GET', path: '/api/vendedores', headers: h }, {});
  console.log('\nTentativa de acessar vendedores (deve ser negado):');
  console.log('  Status:', vendRes.status, '|', vendRes.body.erro || 'OK');
}

main().catch(console.error);
