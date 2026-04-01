const http = require('http');

function req(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const r = http.request({
      hostname: 'localhost', port: 3001, path, method,
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
  const login = await req('POST', '/api/auth/login', { email: 'sabrina.pomim@penaestrada.com', senha: '10Brasilsul' });
  const token = login.token;

  const resumo = await req('GET', '/api/dashboard/resumo', null, token);
  const pedidos = await req('GET', '/api/dashboard/pedidos?limit=5', null, token);
  const viagens = await req('GET', '/api/viagens', null, token);

  console.log('╔══════════════════════════════════════╗');
  console.log('║       TESTE DO DASHBOARD             ║');
  console.log('╚══════════════════════════════════════╝');
  console.log('');
  console.log('📦 VIAGENS CADASTRADAS:', viagens.length);
  viagens.forEach(v => console.log(`   • ${v.nome} — R$ ${v.valor}`));

  console.log('');
  console.log('📊 CARDS DO DASHBOARD:');
  console.log(`   Vendido hoje:    R$ ${(resumo.totalHoje || 0).toFixed(2)}`);
  console.log(`   Vendido no mês:  R$ ${(resumo.totalMes || 0).toFixed(2)}`);
  console.log(`   Pedidos hoje:    ${resumo.pedidosHoje}`);
  console.log(`   Total clientes:  ${resumo.totalClientes}`);
  console.log(`   Ticket médio:    R$ ${(resumo.ticketMedio || 0).toFixed(2)}`);

  console.log('');
  console.log('📋 PEDIDOS RECENTES (últimos 5):');
  pedidos.pedidos?.forEach(p => {
    const status = p.status === 'pago' ? '✅' : p.status === 'cancelado' ? '❌' : '⏳';
    console.log(`   ${status} ${p.nome} — R$ ${p.valor_final?.toFixed(2)} — ${p.forma_pagamento || 'sem pagamento'}`);
  });

  console.log('');
  console.log('📈 VENDAS POR DIA (últimos 7 dias):');
  if (resumo.vendasPorDia?.length) {
    resumo.vendasPorDia.forEach(d => console.log(`   ${d.dia}: ${d.pedidos} pedidos — R$ ${d.total?.toFixed(2)}`));
  } else {
    console.log('   Sem dados (clientes criados há mais de 7 dias ou sem viagem_id)');
  }

  console.log('');
  console.log('💳 DISTRIBUIÇÃO DE PAGAMENTO:');
  resumo.distribuicaoPagamento?.forEach(d => console.log(`   ${d.forma}: ${d.total} pedidos`));

  console.log('');
  console.log('✅ Dashboard OK! Acesse http://localhost:4000');
}

main().catch(console.error);
