const https = require('https');

https.get('https://penaestrada-backend-production-8520.up.railway.app/health', (res) => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Resposta:', d);
    if (res.statusCode === 200) console.log('\n✅ Railway funcionando!');
    else console.log('\n❌ Ainda não está pronto');
  });
}).on('error', e => console.log('Erro:', e.message));
