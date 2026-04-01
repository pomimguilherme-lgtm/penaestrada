const http = require('http');

function req(options, body) {
  return new Promise((resolve, reject) => {
    const b = JSON.stringify(body || {});
    const r = http.request({
      hostname: 'localhost', port: 3001,
      method: options.method || 'GET', path: options.path,
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(b), ...options.headers }
    }, (res) => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(d) }));
    });
    r.on('error', reject); r.write(b); r.end();
  });
}

async function main() {
  console.log('========== TESTE DO SISTEMA ==========\n');

  // 1. Login admin
  const loginAdmin = await req({ method: 'POST', path: '/api/auth/login' }, { email: 'sabrina.pomim@penaestrada.com', senha: '10Brasilsul' });
  const okAdmin = loginAdmin.status === 200;
  console.log(`[${okAdmin ? 'OK' : 'FALHOU'}] Login Admin (sabrina.pomim@penaestrada.com): ${okAdmin ? loginAdmin.body.usuario.nome + ' - ' + loginAdmin.body.usuario.tipo : loginAdmin.body.erro}`);

  // Fallback para admin padrao se o novo nao funcionar
  let tokenAdmin = loginAdmin.body.token;
  if (!okAdmin) {
    const fb = await req({ method: 'POST', path: '/api/auth/login' }, { email: 'admin@penaestrada.com', senha: 'admin123' });
    tokenAdmin = fb.body.token;
    console.log(`       Usando admin padrao: ${fb.status === 200 ? 'OK' : 'FALHOU'}`);
  }
  const hA = { Authorization: 'Bearer ' + tokenAdmin };

  // 2. Login vendedora
  const loginAna = await req({ method: 'POST', path: '/api/auth/login' }, { email: 'ana@penaestrada.com', senha: 'vendedor123' });
  const okAna = loginAna.status === 200;
  console.log(`[${okAna ? 'OK' : 'FALHOU'}] Login Vendedora (ana@penaestrada.com): ${okAna ? loginAna.body.usuario.tipo : loginAna.body.erro}`);
  const hV = { Authorization: 'Bearer ' + loginAna.body.token };

  // 3. Viagens
  const viagens = await req({ method: 'GET', path: '/api/viagens', headers: hA }, {});
  console.log(`[${viagens.status === 200 ? 'OK' : 'FALHOU'}] Listar viagens: ${viagens.body.length} viagens encontradas`);

  // 4. Clientes (admin ve todos)
  const clientesAdmin = await req({ method: 'GET', path: '/api/clientes', headers: hA }, {});
  console.log(`[${clientesAdmin.status === 200 ? 'OK' : 'FALHOU'}] Admin - listar clientes: ${clientesAdmin.body.length} clientes`);

  // 5. Clientes (vendedora ve so os dela)
  const clientesAna = await req({ method: 'GET', path: '/api/clientes', headers: hV }, {});
  console.log(`[${clientesAna.status === 200 ? 'OK' : 'FALHOU'}] Vendedora - listar clientes: ${clientesAna.body.length} clientes (apenas os dela)`);

  // 6. Vendedora nao pode ver vendedores
  const vendedores = await req({ method: 'GET', path: '/api/vendedores', headers: hV }, {});
  console.log(`[${vendedores.status === 403 ? 'OK' : 'FALHOU'}] Vendedora bloqueada de /vendedores: status ${vendedores.status}`);

  // 7. Dashboard
  const dash = await req({ method: 'GET', path: '/api/dashboard', headers: hA }, {});
  const okDash = dash.status === 200;
  console.log(`[${okDash ? 'OK' : 'FALHOU'}] Dashboard:`);
  if (okDash) {
    console.log(`        Total clientes : ${dash.body.totalClientes}`);
    console.log(`        Total viagens  : ${dash.body.totalViagens}`);
    console.log(`        Receita total  : R$ ${Number(dash.body.receitaTotal).toFixed(2)}`);
    console.log(`        Por viagem     : ${dash.body.receitaPorViagem.length} viagens`);
    console.log(`        Por vendedor   : ${dash.body.vendasPorVendedor.length} vendedores`);
  }

  // 8. Cadastrar cliente novo com novos campos
  if (viagens.body.length > 0) {
    const v = viagens.body[0];
    const novoCliente = await req({ method: 'POST', path: '/api/clientes', headers: hV }, {
      nome: 'Teste Silva', telefone: '(11) 91234-0000',
      cpf: '111.222.333-44', rg: '12.345.678-9',
      data_nascimento: '1990-05-15',
      destino: v.destino, data_viagem: v.data_saida,
      viagem_id: v.id, desconto: 100, adicional: 50,
      observacoes: 'Cliente de teste automatizado'
    });
    const ok = novoCliente.status === 201;
    console.log(`[${ok ? 'OK' : 'FALHOU'}] Cadastrar cliente com novos campos: ${ok ? 'id=' + novoCliente.body.id : novoCliente.body.erro}`);

    // Limpar cliente de teste
    if (ok) {
      await req({ method: 'DELETE', path: '/api/clientes/' + novoCliente.body.id, headers: hV }, {});
      console.log(`[OK] Cliente de teste removido`);
    }
  }

  console.log('\n========== FIM DOS TESTES ==========');
}

main().catch(console.error);
