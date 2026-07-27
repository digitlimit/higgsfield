import assert from 'node:assert/strict'
import test from 'node:test'
import { createHiggsfield } from '../dist/index.js'
import { createFetchQueue, jsonResponse } from './helpers.mjs'

const envNames = [
  'HIGGSFIELD_BASE_URL',
  'HIGGSFIELD_KEY',
  'HIGGSFIELD_SECRET',
  'HIGGSFIELD_CALLBACK',
  'HF_KEY',
  'HF_API_KEY',
  'HF_API_SECRET',
]

function withEnvironment(values, callback) {
  const before = Object.fromEntries(envNames.map((name) => [name, process.env[name]]))

  for (const name of envNames) {
    delete process.env[name]
  }
  Object.assign(process.env, values)

  return Promise.resolve()
    .then(callback)
    .finally(() => {
      for (const name of envNames) {
        const value = before[name]
        if (value === undefined) {
          delete process.env[name]
        } else {
          process.env[name] = value
        }
      }
    })
}

test('loads the requested HIGGSFIELD_* environment variables', async () => {
  await withEnvironment(
    {
      HIGGSFIELD_BASE_URL: 'https://api.example.test/root/',
      HIGGSFIELD_KEY: 'env-key',
      HIGGSFIELD_SECRET: 'env-secret',
      HIGGSFIELD_CALLBACK: 'https://app.example.test/generations/higgsfield/callback',
    },
    async () => {
      const mock = createFetchQueue([
        jsonResponse({ status: 'queued', request_id: 'env-request' }),
      ])
      const client = createHiggsfield({ fetch: mock.fetch })

      await client.submit({
        model: 'higgsfield/soul-standard',
        prompt: 'A portrait',
      })

      const url = new URL(mock.calls[0].input)
      assert.equal(url.origin, 'https://api.example.test')
      assert.equal(url.pathname, '/root/higgsfield-ai/soul/standard')
      assert.equal(
        url.searchParams.get('hf_webhook'),
        'https://app.example.test/generations/higgsfield/callback',
      )

      const headers = new Headers(mock.calls[0].init.headers)
      assert.equal(headers.get('hf-api-key'), 'env-key')
      assert.equal(headers.get('hf-secret'), 'env-secret')
    },
  )
})

test('allows the configured callback to be disabled per request', async () => {
  await withEnvironment(
    {
      HIGGSFIELD_KEY: 'env-key',
      HIGGSFIELD_SECRET: 'env-secret',
      HIGGSFIELD_CALLBACK: 'https://app.example.test/callback',
    },
    async () => {
      const mock = createFetchQueue([
        jsonResponse({ status: 'queued', request_id: 'env-request-2' }),
      ])
      const client = createHiggsfield({ fetch: mock.fetch })

      await client.submit({
        model: 'higgsfield/soul-standard',
        prompt: 'A portrait',
        webhookUrl: false,
      })

      const url = new URL(mock.calls[0].input)
      assert.equal(url.searchParams.has('hf_webhook'), false)
    },
  )
})
