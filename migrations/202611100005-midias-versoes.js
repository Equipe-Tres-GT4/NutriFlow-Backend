
import { DataTypes } from 'sequelize'

// Migration retomável, inclusive após DDL parcial no TiDB.
export async function up(q, transaction) {
  async function adicionarSeFaltar(tabela, coluna, definicao) {
    const colunas = await q.describeTable(tabela)

    if (!Object.prototype.hasOwnProperty.call(colunas, coluna)) {
      await q.addColumn(tabela, coluna, definicao, { transaction })
    }
  }

  await adicionarSeFaltar('usuarios', 'foto_url', {
    type: DataTypes.STRING(500),
  })

  await adicionarSeFaltar('receitas', 'video_url', {
    type: DataTypes.STRING(500),
  })

  await adicionarSeFaltar('receitas', 'foto_credito', {
    type: DataTypes.TEXT,
  })

  // Relacionamento opcional, sem FK autorreferente no banco.
  await adicionarSeFaltar('receitas', 'receita_original_id', {
    type: DataTypes.INTEGER,
  })

  await adicionarSeFaltar('publicacoes', 'video_url', {
    type: DataTypes.STRING(500),
  })

  const indices = await q.showIndex('receitas')

  if (!indices.some(indice => indice.name === 'receitas_original_idx')) {
    await q.addIndex('receitas', ['receita_original_id'], {
      name: 'receitas_original_idx',
      transaction,
    })
  }
}
