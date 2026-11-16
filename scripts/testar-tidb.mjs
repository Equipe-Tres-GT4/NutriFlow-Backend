
import mysql from 'mysql2/promise'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import 'dotenv/config'

const ca = readFileSync(resolve('certs/isrgrootx1.pem'))

async function testar() {
  let conexao

  try {
    conexao = await mysql.createConnection({
      host: process.env.TIDB_HOST,
      port: Number(process.env.TIDB_PORT || 4000),
      user: process.env.TIDB_USER,
      password: process.env.TIDB_PASSWORD,
      ssl: {
        ca,
        rejectUnauthorized: true
      },
      connectTimeout: 20000
    })

    const [versao] = await conexao.query('SELECT VERSION() AS versao')
    console.log('Conexão segura estabelecida!')
    console.log('Servidor:', versao[0].versao)

    await conexao.query(
      'CREATE DATABASE IF NOT EXISTS nutriflow_db CHARACTER SET utf8mb4'
    )

    const [bancos] = await conexao.query(
      "SHOW DATABASES LIKE 'nutriflow_db'"
    )

    console.log('Banco NutriFlow encontrado:', bancos.length === 1)
  } catch (erro) {
    console.error('Erro de conexão:', erro.message)
    process.exitCode = 1
  } finally {
    if (conexao) await conexao.end()
  }
}

testar()
