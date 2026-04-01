const express = require('express');
const { db } = require('../db');
const { autenticar } = require('../middleware/auth');
const { gerarParcelas } = require('./parcelas');

const router = express.Router();

router.get('/', autenticar, (req, res) => {
  const { viagem_id, busca } = req.query;
  let query = `
    SELECT c.*, u.nome as vendedor_nome, v.nome as viagem_nome, v.valor as viagem_valor,
           v.destino as viagem_destino, v.data_saida as viagem_data_saida
    FROM clientes c
    LEFT JOIN usuarios u ON c.vendedor_id = u.id
    LEFT JOIN viagens v ON c.viagem_id = v.id
    WHERE 1=1
  `;
  const params = [];

  if (req.usuario.tipo === 'vendedor') {
    query += ' AND c.vendedor_id = ?';
    params.push(req.usuario.id);
  }
  if (viagem_id) {
    query += ' AND c.viagem_id = ?';
    params.push(viagem_id);
  }
  if (busca) {
    query += ' AND (c.nome LIKE ? OR c.cpf LIKE ? OR c.rg LIKE ? OR c.telefone LIKE ?)';
    params.push(`%${busca}%`, `%${busca}%`, `%${busca}%`, `%${busca}%`);
  }
  query += ' ORDER BY c.created_at DESC';

  const clientes = db.prepare(query).all(...params);
  res.json(clientes);
});

router.post('/', autenticar, (req, res) => {
  const {
    nome, telefone, cpf, rg, data_nascimento, destino, data_viagem, viagem_id,
    desconto, adicional, observacoes,
    forma_pagamento, tipo_cartao, num_parcelas, data_primeira_parcela, status,
  } = req.body;

  if (!nome || !telefone || !viagem_id) {
    return res.status(400).json({ erro: 'Campos obrigatorios: nome, telefone, viagem' });
  }
  if (!forma_pagamento) {
    return res.status(400).json({ erro: 'Forma de pagamento obrigatoria' });
  }

  const result = db.prepare(
    `INSERT INTO clientes (nome, telefone, cpf, rg, data_nascimento, destino, data_viagem, viagem_id,
      vendedor_id, desconto, adicional, observacoes,
      forma_pagamento, tipo_cartao, num_parcelas, data_primeira_parcela, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    nome, telefone, cpf || null, rg || null, data_nascimento || null,
    destino || null, data_viagem || null, viagem_id,
    req.usuario.id,
    desconto || 0, adicional || 0, observacoes || null,
    forma_pagamento,
    tipo_cartao || null,
    num_parcelas || 1,
    data_primeira_parcela || null,
    status || 'pendente',
  );

  const clienteId = result.lastInsertRowid;

  // Gerar parcelas para boleto ou cartao credito com parcelamento
  if (data_primeira_parcela && num_parcelas > 1 &&
      (forma_pagamento === 'boleto' || (forma_pagamento === 'cartao' && tipo_cartao === 'credito'))) {
    gerarParcelas(clienteId, num_parcelas, data_primeira_parcela);
  }

  res.status(201).json({ id: clienteId, nome, forma_pagamento, num_parcelas });
});

router.put('/:id', autenticar, (req, res) => {
  const cliente = db.prepare('SELECT * FROM clientes WHERE id = ?').get(req.params.id);
  if (!cliente) return res.status(404).json({ erro: 'Cliente nao encontrado' });

  if (req.usuario.tipo === 'vendedor' && cliente.vendedor_id !== req.usuario.id) {
    return res.status(403).json({ erro: 'Sem permissao para editar este cliente' });
  }

  const {
    nome, telefone, cpf, rg, data_nascimento, destino, data_viagem, viagem_id,
    desconto, adicional, observacoes,
    forma_pagamento, tipo_cartao, num_parcelas, data_primeira_parcela,
  } = req.body;

  db.prepare(
    `UPDATE clientes SET nome=?, telefone=?, cpf=?, rg=?, data_nascimento=?, destino=?, data_viagem=?,
      viagem_id=?, desconto=?, adicional=?, observacoes=?,
      forma_pagamento=?, tipo_cartao=?, num_parcelas=?, data_primeira_parcela=?
     WHERE id=?`
  ).run(
    nome || cliente.nome,
    telefone || cliente.telefone,
    cpf !== undefined ? cpf : cliente.cpf,
    rg !== undefined ? rg : cliente.rg,
    data_nascimento !== undefined ? data_nascimento : cliente.data_nascimento,
    destino !== undefined ? destino : cliente.destino,
    data_viagem !== undefined ? data_viagem : cliente.data_viagem,
    viagem_id !== undefined ? viagem_id : cliente.viagem_id,
    desconto !== undefined ? desconto : (cliente.desconto || 0),
    adicional !== undefined ? adicional : (cliente.adicional || 0),
    observacoes !== undefined ? observacoes : cliente.observacoes,
    forma_pagamento || cliente.forma_pagamento,
    tipo_cartao !== undefined ? tipo_cartao : cliente.tipo_cartao,
    num_parcelas || cliente.num_parcelas || 1,
    data_primeira_parcela !== undefined ? data_primeira_parcela : cliente.data_primeira_parcela,
    req.params.id,
  );

  // Regenerar parcelas se alterou dados de pagamento
  const novaForma = forma_pagamento || cliente.forma_pagamento;
  const novoTipo = tipo_cartao !== undefined ? tipo_cartao : cliente.tipo_cartao;
  const novaParcelas = num_parcelas || cliente.num_parcelas || 1;
  const novaData = data_primeira_parcela !== undefined ? data_primeira_parcela : cliente.data_primeira_parcela;

  if (novaData && novaParcelas > 1 &&
      (novaForma === 'boleto' || (novaForma === 'cartao' && novoTipo === 'credito'))) {
    gerarParcelas(Number(req.params.id), novaParcelas, novaData);
  } else if (novaForma === 'pix' || (novaForma === 'cartao' && novoTipo === 'debito')) {
    db.prepare('DELETE FROM parcelas WHERE cliente_id = ?').run(req.params.id);
  }

  res.json({ ...cliente, ...req.body, id: Number(req.params.id) });
});

router.delete('/:id', autenticar, (req, res) => {
  const cliente = db.prepare('SELECT * FROM clientes WHERE id = ?').get(req.params.id);
  if (!cliente) return res.status(404).json({ erro: 'Cliente nao encontrado' });

  if (req.usuario.tipo === 'vendedor' && cliente.vendedor_id !== req.usuario.id) {
    return res.status(403).json({ erro: 'Sem permissao para remover este cliente' });
  }

  db.prepare('DELETE FROM parcelas WHERE cliente_id = ?').run(req.params.id);
  db.prepare('DELETE FROM clientes WHERE id = ?').run(req.params.id);
  res.json({ mensagem: 'Cliente removido' });
});

module.exports = router;
