const https = require('https');

https.get('https://penaestrada-backend.onrender.com/health', (res) => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    console.log('Status HTTP:', res.statusCode);
    console.log('Resposta:', d);
    if (res.statusCode === 200) {
      console.log('\n✅ Novo codigo deployado! Backend funcionando.');
    } else {
      console.log('\n⏳ Ainda usando codigo antigo. Redeploy em andamento...');
    }
  });
}).on('error', (e) => console.log('Erro:', e.message));
