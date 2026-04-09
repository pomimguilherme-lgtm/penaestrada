const https = require('https')
const { createClient } = require('@libsql/client')
const path = require('path')

const RAILWAY_URL = 'https://penaestrada-backend-production-8520.up.railway.app'
const SECRET = 'penaestrada-backup-2024'
const DB_LOCAL = path.join(__dirname, '..', 'database.db')

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => {
        try { resolve(JSON.parse(data)) }
        catch(e) { reject(new Error('Resposta invalida: ' + data.slice(0, 200))) }
      })
    }).on('error', reject)
  })
}

async function main() {
  console.log('Baixando dados do Railway...')
  const dados = await fetchJson(`${RAILWAY_URL}/api/admin/exportar?secret=${SECRET}`)

  if (dados.erro) {
    console.error('Erro ao exportar:', dados.erro)
    return
  }

  for (const [tabela, rows] of Object.entries(dados)) {
    console.log(`  ${tabela}: ${rows.length} registros`)
  }

  console.log('\nImportando para banco local...')
  const db = createClient({ url: 'file:' + DB_LOCAL })

  const ordemLimpeza = [
    'quarto_pessoas', 'quartos', 'galeria_midias', 'galerias',
    'parcelas', 'reserva_passageiros', 'reservas',
    'base_clientes', 'viagens', 'usuarios'
  ]
  for (const tabela of ordemLimpeza) {
    try { await db.execute(`DELETE FROM ${tabela}`) }
    catch(e) { console.warn(`  aviso ao limpar ${tabela}:`, e.message) }
  }

  const ordemInsert = [
    'usuarios', 'viagens', 'base_clientes', 'reservas',
    'reserva_passageiros', 'parcelas', 'galerias', 'galeria_midias',
    'quartos', 'quarto_pessoas'
  ]

  for (const tabela of ordemInsert) {
    const rows = dados[tabela]
    if (!rows || rows.length === 0) { console.log(`  ${tabela}: 0 registros`); continue }

    const colunas = Object.keys(rows[0])
    const placeholders = colunas.map((_, i) => `?${i + 1}`).join(', ')
    const sql = `INSERT OR REPLACE INTO ${tabela} (${colunas.join(', ')}) VALUES (${placeholders})`

    let ok = 0
    for (const row of rows) {
      try {
        await db.execute({ sql, args: colunas.map(c => row[c] ?? null) })
        ok++
      } catch(e) {
        console.warn(`  erro ao inserir em ${tabela}:`, e.message)
      }
    }
    console.log(`  ${tabela}: ${ok}/${rows.length} inseridos`)
  }

  console.log('\nImportacao concluida! Reinicie o backend local para ver os dados.')
}

main().catch(console.error)
