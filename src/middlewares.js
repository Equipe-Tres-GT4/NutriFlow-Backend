/** Valida a origem de requisições que alteram dados (proteção CSRF).
 * Endereços oficiais são aceitos mesmo sem configurar CORS_ORIGIN no Render.
 * CORS_ORIGIN pode acrescentar outras origens, separadas por vírgulas.
 */
const ORIGENS_OFICIAIS = [
  'http://localhost:5173',
  'https://numnum-kappa.vercel.app',
  'https://nutrinnn.vercel.app',
]

export function origemDeEscritaPermitida(req, origens = process.env.CORS_ORIGIN || '') {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return true
  const origin = req.headers.origin
  if (!origin) return true // clientes sem navegador (curl, Swagger, testes)
  try {
    const url = new URL(origin)
    if (url.origin !== origin || !['http:', 'https:'].includes(url.protocol)) return false
    const extras = origens.split(',').map(s => s.trim()).filter(Boolean)
    return [...ORIGENS_OFICIAIS, ...extras].includes(origin) || url.host === req.headers.host
  } catch { return false }
}

export function verificarOrigem(req, res, next) {
  if (!origemDeEscritaPermitida(req)) return res.status(403).json({ erro: 'Origem não permitida.' })
  next()
}

export function tratarErro(err, _req, res, _next) {
  if (process.env.NODE_ENV !== 'production') console.error('[API]', err.message)
  if (err.name === 'SequelizeUniqueConstraintError') return res.status(409).json({ erro: 'Já existe um registro com esses dados.' })
  if (err.type === 'entity.too.large') return res.status(413).json({ erro: 'Conteúdo acima do limite permitido.' })
  const status = Number.isInteger(err.status) && err.status >= 400 && err.status < 600 ? err.status : 500
  return res.status(status).json({ erro: status === 500 ? 'Erro interno. Tente novamente.' : err.message })
}
