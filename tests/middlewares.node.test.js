import test from 'node:test'
import assert from 'node:assert/strict'
import { origemDeEscritaPermitida } from '../src/middlewares.js'

const host = 'localhost:3001'
test('leituras sem efeito colateral passam independentemente da origem', () => {
  assert.equal(origemDeEscritaPermitida({ method: 'GET', headers: { origin: 'https://outro.tld', host } }), true)
})
test('escritas negam origem cruzada desconhecida', () => {
  assert.equal(origemDeEscritaPermitida({ method: 'POST', headers: { origin: 'https://malicioso.tld', host } }), false)
  assert.equal(origemDeEscritaPermitida({ method: 'POST', headers: { origin: 'https://numnum-kappa.vercel.app.malicioso.tld', host } }), false)
})
test('escritas aceitam os domínios oficiais e a mesma origem', () => {
  for (const origin of ['http://localhost:5173', 'https://numnum-kappa.vercel.app', 'https://nutrinnn.vercel.app', 'http://localhost:3001']) {
    assert.equal(origemDeEscritaPermitida({ method: 'POST', headers: { origin, host } }, ''), true, origin)
  }
})
test('CORS_ORIGIN adiciona endereços sem retirar os oficiais', () => {
  const extra = 'https://frontend-novo.vercel.app'
  assert.equal(origemDeEscritaPermitida({ method: 'PATCH', headers: { origin: extra, host } }, extra), true)
  assert.equal(origemDeEscritaPermitida({ method: 'POST', headers: { origin: 'https://numnum-kappa.vercel.app', host } }, extra), true)
})
