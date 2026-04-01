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
  // Login
  const login = await req('POST', '/api/auth/login', { email: 'sabrina.pomim@penaestrada.com', senha: '10Brasilsul' });
  const token = login.token;
  console.log('✅ Login OK');

  // Criar vendedor de teste
  try {
    const v = await req('POST', '/api/vendedores', { nome: 'Carlos Vendedor', email: 'carlos@penaestrada.com', senha: '123456' }, token);
    console.log('✅ Vendedor criado:', v.nome || JSON.stringify(v));
  } catch(e) { console.log('ℹ️ Vendedor já existe'); }

  // Buscar viagens
  const viagens = await req('GET', '/api/viagens', null, token);
  let viagemId = viagens[0]?.id;

  if (!viagemId) {
    // Criar viagem de teste
    const v1 = await req('POST', '/api/viagens', {
      nome: 'Rio de Janeiro - Carnaval', destino: 'Rio de Janeiro - RJ',
      data_saida: '2026-02-28', data_retorno: '2026-03-05',
      valor: 1500, descricao: 'Pacote carnaval com hotel'
    }, token);
    const v2 = await req('POST', '/api/viagens', {
      nome: 'Gramado de Inverno', destino: 'Gramado - RS',
      data_saida: '2026-07-10', data_retorno: '2026-07-15',
      valor: 1200, descricao: 'Pacote inverno Gramado'
    }, token);
    const v3 = await req('POST', '/api/viagens', {
      nome: 'Bonito Ecoturismo', destino: 'Bonito - MS',
      data_saida: '2026-09-01', data_retorno: '2026-09-07',
      valor: 2200, descricao: 'Pacote ecoturismo Bonito'
    }, token);
    console.log('✅ Viagens criadas');
    viagemId = v1.id;
  }

  // Buscar viagens novamente
  const viagens2 = await req('GET', '/api/viagens', null, token);
  const ids = viagens2.map(v => v.id);

  // Criar clientes com diferentes status e pagamentos
  const clientes = [
    { nome: 'Maria Silva', telefone: '11999990001', cpf: '111.111.111-01', viagem_id: ids[0], forma_pagamento: 'pix', status: 'pago', desconto: 0, adicional: 0 },
    { nome: 'João Santos', telefone: '11999990002', cpf: '111.111.111-02', viagem_id: ids[0], forma_pagamento: 'cartao', tipo_cartao: 'credito', num_parcelas: 3, status: 'pago', desconto: 100, adicional: 0 },
    { nome: 'Ana Oliveira', telefone: '11999990003', cpf: '111.111.111-03', viagem_id: ids[1] || ids[0], forma_pagamento: 'boleto', num_parcelas: 2, status: 'pendente', desconto: 0, adicional: 50 },
    { nome: 'Pedro Costa', telefone: '11999990004', cpf: '111.111.111-04', viagem_id: ids[1] || ids[0], forma_pagamento: 'pix', status: 'pendente', desconto: 200, adicional: 0 },
    { nome: 'Lucia Ferreira', telefone: '11999990005', cpf: '111.111.111-05', viagem_id: ids[2] || ids[0], forma_pagamento: 'cartao', tipo_cartao: 'debito', num_parcelas: 1, status: 'pago', desconto: 0, adicional: 100 },
    { nome: 'Roberto Lima', telefone: '11999990006', cpf: '111.111.111-06', viagem_id: ids[2] || ids[0], forma_pagamento: 'pix', status: 'cancelado', desconto: 0, adicional: 0 },
  ];

  let criados = 0;
  for (const c of clientes) {
    try {
      await req('POST', '/api/clientes', c, token);
      criados++;
    } catch(e) {}
  }
  console.log(`✅ ${criados} clientes criados`);

  // Verificar dashboard
  const resumo = await req('GET', '/api/dashboard/resumo', null, token);
  console.log('\n📊 DASHBOARD:');
  console.log('   Total clientes:', resumo.totalClientes);
  console.log('   Total viagens:', resumo.totalViagens);
  console.log('   Receita total: R$', resumo.receitaTotal?.toFixed(2));
  console.log('   Pedidos hoje:', resumo.pedidosHoje);
  console.log('\n✅ Dados carregados! Acesse http://localhost:4000 e veja o dashboard.');
}

main().catch(console.error);
