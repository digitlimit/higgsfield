import assert from 'node:assert/strict'
import test from 'node:test'
import {
  HiggsfieldValidationError,
  HiggsfieldWebhookVerificationError,
  parseWebhook,
} from '../dist/index.js'

test('parses a completed image webhook', async () => {
  const result = await parseWebhook(
    JSON.stringify({
      status: 'completed',
      request_id: 'webhook-1',
      images: [{ url: 'https://cdn.example.test/image.jpg' }],
    }),
  )

  assert.equal(result.status, 'completed')
  assert.equal(result.images[0].url, 'https://cdn.example.test/image.jpg')
})

test('supports an application-provided webhook verifier', async () => {
  const result = await parseWebhook(
    JSON.stringify({ status: 'failed', request_id: 'webhook-2' }),
    {
      headers: { 'x-signature': 'valid' },
      verify: ({ headers }) => headers['x-signature'] === 'valid',
    },
  )

  assert.equal(result.status, 'failed')
})

test('rejects a failed webhook verification', async () => {
  await assert.rejects(
    parseWebhook(
      JSON.stringify({ status: 'completed', request_id: 'webhook-3' }),
      { verify: () => false },
    ),
    HiggsfieldWebhookVerificationError,
  )
})

test('rejects non-terminal webhook statuses', async () => {
  await assert.rejects(
    parseWebhook({ status: 'queued', request_id: 'webhook-4' }),
    HiggsfieldValidationError,
  )
})
