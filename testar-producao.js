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
      res.on('end', () => { try { resolve({ status: res.statusCode, body: JSON.parse(d) }); } catch { resolve({ status: res.statusCode, body: d }); } });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

async function main() {
  console.log('🌐 Testando sistema em PRODUÇÃO...');
  console.log('   Backend: https://penaestrada-backend.onrender.com');
  console.log('   Frontend: https://penaestrada.vercel.app');
  console.log('');

  console.log('⏳ Conectando ao backend (pode demorar ~30s na primeira vez)...');
  
  try {
    const login = await req('POST', '/api/auth/login', { email: 'sabrina.pomim@penaestrada.com', senha: '10Brasilsul' });
    
    if (login.body.token) {
      console.log('✅ LOGIN OK em produção!');
      console.log('   Usuário:', login.body.usuario?.nome);
      console.log('   Tipo:', login.body.usuario?.tipo);
      console.log('');
      console.log('🎉 SISTEMA ONLINE E FUNCIONANDO!');
      console.log('   Acesse: https://penaestrada.vercel.app');
    } else {
      console.log('❌ Login falhou:', JSON.stringify(login.body));
    }
  } catch(e) {
    console.log('❌ Erro de conexão:', e.message);
    console.log('   O backend pode estar acordando. Tente acessar o site em 1 minuto.');
  }
}

main();
