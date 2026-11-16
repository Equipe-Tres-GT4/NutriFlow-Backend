
import 'dotenv/config'
import mysql from 'mysql2/promise'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const destino = resolve(
  '../../backups-nutriflow/nutriflow-local.json'
)

const db = await mysql.createConnection({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  dateStrings: true,
})

try {
  const [tabelas] = await db.query('SHOW TABLES')
  const backup = {
    criadoEm: new Date().toISOString(),
    banco: process.env.DB_NAME,
    tabelas: {},
  }

  for (const item of tabelas) {
    const nome = Object.values(item)[0]

    const [estrutura] = await db.query(
      'SHOW CREATE TABLE ??', [nome]
    )

    const [registros] = await db.query(
      'SELECT * FROM ??', [nome]
    )

    backup.tabelas[nome] = {
      estrutura: estrutura[0]['Create Table'],
      registros,
    }

    console.log(`${nome}: ${registros.length} registros`)
  }

  await mkdir(resolve('../../backups-nutriflow'), {
    recursive: true,
  })

  await writeFile(
    destino,
    JSON.stringify(backup, null, 2)
  )

  console.log('Backup realizado:', destino)
} catch (erro) {
  console.error('Erro:', erro.message)
  process.exitCode = 1
} finally {
  await db.end()
}
