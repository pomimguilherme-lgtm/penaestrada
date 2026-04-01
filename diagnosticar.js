const https = require('https');

function req(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const r = https.request({
      hostname: 'penaestrada-backend-production-8520.up.railway.app',
      path, method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {})
      }
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve({ status: res.statusCode, body: JSON.parse(d) }); } catch { resolve({ status: res.statusCode, body: d }); } });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

async function main() {
  console.log('🔍 Diagnosticando o problema...\n');

  // 1. Testar health
  const health = await req('GET', '/health');
  console.log('Backend:', health.status === 200 ? '✅ Online' : '❌ Offline', JSON.stringify(health.body));

  // 2. Tentar login com sabrina
  const login1 = await req('POST', '/api/auth/login', { email: 'sabrina.pomim@penaestrada.com', senha: '10Brasilsul' });
  console.log('\nLogin Sabrina:', login1.status === 200 ? '✅ OK' : '❌ Falhou', JSON.stringify(login1.body));

  // 3. Tentar login com admin padrão
  const login2 = await req('POST', '/api/auth/login', { email: 'admin@penaestrada.com', senha: 'admin123' });
  console.log('Login admin padrão:', login2.status === 200 ? '✅ OK' : '❌ Falhou', JSON.stringify(login2.body));

  if (login1.body.token) {
    const token = login1.body.token;
    // 4. Testar listagem de clientes
    const clientes = await req('GET', '/api/clientes', null, token);
    console.log('\nClientes salvos:', clientes.status === 200 ? `✅ ${clientes.body.length || 0} clientes` : '❌ Erro', );

    // 5. Testar criação de cliente
    const novoCliente = await req('POST', '/api/clientes', {
      nome: 'Teste Diagnóstico', telefone: '11999999999',
      viagem_id: 1, forma_pagamento: 'pix', status: 'pendente'
    }, token);
    console.log('Criar cliente teste:', novoCliente.status === 201 ? '✅ Salvo' : `❌ Erro: ${JSON.stringify(novoCliente.body)}`);

    // 6. Verificar se persiste
    const clientes2 = await req('GET', '/api/clientes', null, token);
    console.log('Após salvar:', clientes2.status === 200 ? `${clientes2.body.length || 0} clientes` : 'Erro');
  }

  console.log('\n⚠️  Se login falhou: banco foi resetado — precisa de volume persistente no Railway');
}

main().catch(console.error);
