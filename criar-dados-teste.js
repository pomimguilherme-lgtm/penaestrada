const http = require('http');

function request(options, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(body || {});
    const opts = {
      hostname: 'localhost',
      port: 3001,
      method: options.method || 'GET',
      path: options.path,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr),
        ...options.headers,
      },
    };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

async function main() {
  const login = await request(
    { method: 'POST', path: '/api/auth/login' },
    { email: 'admin@penaestrada.com', senha: 'admin123' }
  );
  const token = login.token;
  const h = { Authorization: 'Bearer ' + token };

  console.log('Criando viagens...');

  const viagens = [
    { nome: 'Feriado em Gramado', destino: 'Gramado - RS', data_saida: '2026-04-18', data_retorno: '2026-04-21', valor: 1800.00, descricao: 'Pacote completo com hotel e cafe da manha inclusos.' },
    { nome: 'Verao em Floripa', destino: 'Florianopolis - SC', data_saida: '2026-07-10', data_retorno: '2026-07-17', valor: 2400.00, descricao: 'Semana nas melhores praias de Florianopolis.' },
    { nome: 'Reveillon em Porto Seguro', destino: 'Porto Seguro - BA', data_saida: '2026-12-28', data_retorno: '2027-01-03', valor: 3500.00, descricao: 'Fim de ano na Bahia com festa de reveillon inclusa.' },
    { nome: 'Inverno em Campos do Jordao', destino: 'Campos do Jordao - SP', data_saida: '2026-06-20', data_retorno: '2026-06-23', valor: 1200.00, descricao: 'Festival de Inverno com passeios e fondue.' },
  ];

  const viagensCriadas = [];
  for (const v of viagens) {
    const res = await request({ method: 'POST', path: '/api/viagens', headers: h }, v);
    viagensCriadas.push(res);
    console.log(' Viagem criada:', res.nome || res.erro);
  }

  console.log('\nCriando clientes...');

  const loginVendedor = await request(
    { method: 'POST', path: '/api/auth/login' },
    { email: 'ana@penaestrada.com', senha: 'vendedor123' }
  );
  const hVendedor = { Authorization: 'Bearer ' + loginVendedor.token };

  const clientes = [
    { nome: 'Roberto Almeida', telefone: '(11) 99812-3456', documento: '123.456.789-00', destino: 'Gramado - RS', data_viagem: '2026-04-18', viagem_id: viagensCriadas[0].id },
    { nome: 'Fernanda Lima', telefone: '(11) 97654-3210', documento: '234.567.890-11', destino: 'Gramado - RS', data_viagem: '2026-04-18', viagem_id: viagensCriadas[0].id },
    { nome: 'Marcos Souza', telefone: '(21) 98765-0001', documento: '345.678.901-22', destino: 'Florianopolis - SC', data_viagem: '2026-07-10', viagem_id: viagensCriadas[1].id },
    { nome: 'Juliana Costa', telefone: '(21) 91234-5678', documento: '456.789.012-33', destino: 'Florianopolis - SC', data_viagem: '2026-07-10', viagem_id: viagensCriadas[1].id },
    { nome: 'Paulo Mendes', telefone: '(31) 99001-2233', documento: '567.890.123-44', destino: 'Porto Seguro - BA', data_viagem: '2026-12-28', viagem_id: viagensCriadas[2].id },
    { nome: 'Beatriz Rocha', telefone: '(31) 98877-6655', documento: '678.901.234-55', destino: 'Campos do Jordao - SP', data_viagem: '2026-06-20', viagem_id: viagensCriadas[3].id },
    { nome: 'Diego Ferreira', telefone: '(85) 99321-7890', documento: '789.012.345-66', destino: 'Porto Seguro - BA', data_viagem: '2026-12-28', viagem_id: viagensCriadas[2].id },
    { nome: 'Camila Nunes', telefone: '(47) 97788-4455', documento: '890.123.456-77', destino: 'Gramado - RS', data_viagem: '2026-04-18', viagem_id: viagensCriadas[0].id },
  ];

  for (let i = 0; i < clientes.length; i++) {
    const headers = i < 4 ? hVendedor : h;
    const res = await request({ method: 'POST', path: '/api/clientes', headers }, clientes[i]);
    console.log(' Cliente criado:', res.nome || res.erro);
  }

  console.log('\nDados de teste criados com sucesso!');
  console.log('  4 viagens | 8 clientes');
  console.log('  4 clientes cadastrados pela Ana (vendedora)');
  console.log('  4 clientes cadastrados pelo admin');
}

main().catch(console.error);
