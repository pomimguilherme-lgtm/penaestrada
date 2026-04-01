const https = require('https');

function req(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const r = https.request({
      hostname: 'penaestrada-backend.onrender.com',
      path, method,
      headers: {
        'Content-Type': 'application/json',
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
  console.log('🔄 Configurando admin em produção...');
  const setup = await req('POST', '/api/auth/setup-admin', {
    nome: 'Sabrina Pomim',
    email: 'sabrina.pomim@penaestrada.com',
    senha: '10Brasilsul'
  });
  console.log('Resposta setup:', JSON.stringify(setup));

  if (!setup.ok) {
    console.log('⚠️  Tentando login direto (setup já feito antes)...');
  }

  const login = await req('POST', '/api/auth/login', {
    email: 'sabrina.pomim@penaestrada.com',
    senha: '10Brasilsul'
  });

  if (login.token) {
    console.log('\n✅ LOGIN SABRINA OK em produção!');
    console.log('🎉 SISTEMA 100% ONLINE!');
    console.log('   Site:  https://penaestrada.vercel.app');
    console.log('   Email: sabrina.pomim@penaestrada.com');
    console.log('   Senha: 10Brasilsul');
  } else {
    console.log('❌ Login falhou:', JSON.stringify(login));
    console.log('   Aguarde 1 minuto e rode novamente: node setup-producao.js');
  }
}

main().catch(console.error);
