const https = require('https');

function req(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const r = https.request({
      hostname: 'penaestrada-backend.onrender.com',
      path, method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {})
      }
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve(d); } });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

async function main() {
  console.log('🔑 Fazendo login com admin padrão...');
  const login = await req('POST', '/api/auth/login', { email: 'admin@penaestrada.com', senha: 'admin123' });

  if (!login.token) {
    console.log('❌ Erro:', JSON.stringify(login));
    return;
  }
  console.log('✅ Login OK! Token gerado.');
  const token = login.token;

  // Atualizar admin para sabrina
  console.log('🔄 Atualizando email e senha do admin...');
  const upd = await req('PUT', `/api/vendedores/${login.usuario.id}`, {
    nome: 'Sabrina Pomim',
    email: 'sabrina.pomim@penaestrada.com',
    senha: '10Brasilsul',
    tipo: 'admin',
    status: 'ativo'
  }, token);
  console.log('Resposta:', JSON.stringify(upd));

  // Testar novo login
  console.log('🔑 Testando novo login...');
  const login2 = await req('POST', '/api/auth/login', { email: 'sabrina.pomim@penaestrada.com', senha: '10Brasilsul' });
  if (login2.token) {
    console.log('✅ LOGIN SABRINA OK em produção!');
    console.log('\n🎉 SISTEMA 100% ONLINE!');
    console.log('   Site: https://penaestrada.vercel.app');
    console.log('   Email: sabrina.pomim@penaestrada.com');
    console.log('   Senha: 10Brasilsul');
  } else {
    console.log('❌ Falhou:', JSON.stringify(login2));
  }
}

main().catch(console.error);
