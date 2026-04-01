const http = require('http');

const body = JSON.stringify({ email: 'sabrina.pomim@penaestrada.com', senha: '10Brasilsul' });

const req = http.request({
  hostname: 'localhost',
  port: 3001,
  path: '/api/auth/login',
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const json = JSON.parse(data);
    if (json.token) {
      console.log('✅ LOGIN OK!');
      console.log('   Usuario:', json.usuario?.nome);
      console.log('   Tipo:', json.usuario?.tipo);
      console.log('   Token gerado com sucesso');
    } else {
      console.log('❌ Falhou:', data);
    }
  });
});
req.on('error', e => console.error('❌ Erro:', e.message));
req.write(body);
req.end();
