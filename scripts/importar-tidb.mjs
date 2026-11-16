
import 'dotenv/config'
import mysql from 'mysql2/promise'
import fs from 'node:fs'
import path from 'node:path'

const arquivo = path.resolve(
  '../../backups-nutriflow/nutriflow-local.json'
)

const backup = JSON.parse(fs.readFileSync(arquivo, 'utf8'))

const ordem = [
  'usuarios',
  'alimentos',
  'receitas',
  'publicacoes',
  'alimentos_salvos',
  'receitas_salvas',
  'seguidores',
  'comentarios',
  'curtidas',
  'mensagens',
  'denuncias',
]

function identificador(nome) {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(nome)) {
    throw new Error(`Identificador inválido: ${nome}`)
  }
  return `\`${nome}\``
}

function converterValor(valor) {
  if (
    valor &&
    typeof valor === 'object' &&
    valor.type === 'Buffer' &&
    Array.isArray(valor.data)
  ) {
    return Buffer.from(valor.data)
  }
  return valor
}

if (!backup.tabelas) {
  throw new Error('Arquivo de backup inválido')
}

const tabelasBackup = Object.keys(backup.tabelas)
  .filter(nome => nome !== '_nutriflow_migrations')

const desconhecidas = tabelasBackup.filter(
  nome => !ordem.includes(nome)
)

if (desconhecidas.length) {
  throw new Error(
    `Tabelas sem ordem de importação: ${desconhecidas.join(', ')}`
  )
}

const db = await mysql.createConnection({
  host: process.env.TIDB_HOST,
  port: Number(process.env.TIDB_PORT || 4000),
  user: process.env.TIDB_USER,
  password: process.env.TIDB_PASSWORD,
  database: process.env.TIDB_DATABASE || 'nutriflow_db',
  ssl: {
    ca: fs.readFileSync(
      path.resolve(
        process.env.TIDB_SSL_CA || 'certs/isrgrootx1.pem'
      )
    ),
    rejectUnauthorized: true,
  },
  timezone: 'Z',
})

let transacaoIniciada = false

try {
  console.log('Validando tabelas e colunas no TiDB...')

  for (const tabela of ordem) {
    const dados = backup.tabelas[tabela]
    if (!dados) {
      throw new Error(`Tabela ausente no backup: ${tabela}`)
    }

    const nome = identificador(tabela)
    const [contagem] = await db.query(
      `SELECT COUNT(*) AS total FROM ${nome}`
    )

    if (Number(contagem[0].total) !== 0) {
      throw new Error(
        `A tabela ${tabela} já contém registros. Importação cancelada.`
      )
    }

    const [colunas] = await db.query(
      `SHOW COLUMNS FROM ${nome}`
    )

    const nomes = new Set(colunas.map(c => c.Field))

    for (const registro of dados.registros) {
      for (const campo of Object.keys(registro)) {
        if (!nomes.has(campo)) {
          throw new Error(
            `Coluna ausente no TiDB: ${tabela}.${campo}`
          )
        }
      }
    }
  }

  await db.beginTransaction()
  transacaoIniciada = true

  for (const tabela of ordem) {
    const registros = backup.tabelas[tabela].registros
    const nome = identificador(tabela)

    for (const registro of registros) {
      const campos = Object.keys(registro)
      const colunas = campos.map(identificador).join(', ')
      const marcadores = campos.map(() => '?').join(', ')
      const valores = campos.map(
        campo => converterValor(registro[campo])
      )

      await db.execute(
        `INSERT INTO ${nome} (${colunas}) VALUES (${marcadores})`,
        valores
      )
    }

    const [resultado] = await db.query(
      `SELECT COUNT(*) AS total FROM ${nome}`
    )

    if (Number(resultado[0].total) !== registros.length) {
      throw new Error(
        `Contagem divergente na tabela ${tabela}`
      )
    }

    console.log(`${tabela}: ${registros.length} registros OK`)
  }

  await db.commit()
  transacaoIniciada = false

  console.log('')
  console.log('IMPORTAÇÃO CONCLUÍDA COM SUCESSO!')
} catch (erro) {
  if (transacaoIniciada) {
    await db.rollback()
  }

  console.error('IMPORTAÇÃO NÃO CONCLUÍDA:', erro.message)
  process.exitCode = 1
} finally {
  await db.end()
}
