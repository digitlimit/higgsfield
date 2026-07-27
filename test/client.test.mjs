import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createHiggsfield,
  HiggsfieldApiError,
  HiggsfieldGenerationError,
  HiggsfieldValidationError,
} from '../dist/index.js'
import { createFetchQueue, jsonResponse } from './helpers.mjs'

const credentials = {
  apiKey: 'api-key',
  apiSecret: 'api-secret',
}

test('submits with hf-api-key and hf-secret headers by default', async () => {
  const mock = createFetchQueue([
    jsonResponse({
      status: 'queued',
      request_id: 'request-1',
      status_url: 'https://platform.higgsfield.ai/requests/request-1/status',
      cancel_url: 'https://platform.higgsfield.ai/requests/request-1/cancel',
    }),
  ])

  const client = createHiggsfield({ ...credentials, fetch: mock.fetch })
  const controller = await client.submit({
    model: 'higgsfield/soul-standard',
    prompt: 'A cinematic mountain landscape',
    aspect_ratio: '16:9',
  })

  assert.equal(controller.requestId, 'request-1')
  assert.equal(
    mock.calls[0].input,
    'https://platform.higgsfield.ai/higgsfield-ai/soul/standard',
  )

  const headers = new Headers(mock.calls[0].init.headers)
  assert.equal(headers.get('hf-api-key'), 'api-key')
  assert.equal(headers.get('hf-secret'), 'api-secret')
  assert.equal(headers.get('authorization'), null)

  const body = JSON.parse(mock.calls[0].init.body)
  assert.deepEqual(body, {
    prompt: 'A cinematic mountain landscape',
    aspect_ratio: '16:9',
  })
})

test('supports Authorization: Key authentication', async () => {
  const mock = createFetchQueue([
    jsonResponse({ status: 'queued', request_id: 'request-2' }),
  ])

  const client = createHiggsfield({
    ...credentials,
    authMode: 'authorization',
    fetch: mock.fetch,
  })

  await client.submit({
    model: 'higgsfield/soul-standard',
    prompt: 'Portrait',
  })

  const headers = new Headers(mock.calls[0].init.headers)
  assert.equal(headers.get('authorization'), 'Key api-key:api-secret')
  assert.equal(headers.get('hf-api-key'), null)
})

test('passes the webhook URL as hf_webhook and redacts it from errors', async () => {
  const mock = createFetchQueue([
    jsonResponse({ message: 'temporary failure' }, { status: 500 }),
  ])

  const client = createHiggsfield({ ...credentials, fetch: mock.fetch })

  await assert.rejects(
    client.submit({
      model: 'higgsfield/soul-standard',
      prompt: 'Portrait',
      webhookUrl: 'https://example.test/hooks/secret-token',
    }),
    (error) => {
      assert.ok(error instanceof HiggsfieldApiError)
      assert.match(mock.calls[0].input, /hf_webhook=/)
      assert.doesNotMatch(error.url, /secret-token/)
      return true
    },
  )
})

test('generate waits for queued, in-progress and completed statuses', async () => {
  const mock = createFetchQueue([
    jsonResponse({ status: 'queued', request_id: 'request-3' }),
    jsonResponse({ status: 'in_progress', request_id: 'request-3' }),
    jsonResponse({
      status: 'completed',
      request_id: 'request-3',
      images: [{ url: 'https://cdn.example.test/image.jpg' }],
    }),
  ])

  const statuses = []
  const client = createHiggsfield({
    ...credentials,
    fetch: mock.fetch,
    polling: {
      intervalMs: 0,
      maxIntervalMs: 0,
      jitterRatio: 0,
    },
  })

  const result = await client.generate({
    model: 'higgsfield/soul-standard',
    prompt: 'A studio portrait',
    polling: {
      emitUnchangedStatus: true,
      onStatus: (response) => statuses.push(response.status),
    },
  })

  assert.equal(result.status, 'completed')
  assert.equal(result.images[0].url, 'https://cdn.example.test/image.jpg')
  assert.deepEqual(statuses, ['queued', 'in_progress', 'completed'])
  assert.equal(mock.calls.length, 3)
})

test('throws a generation error for terminal failure', async () => {
  const mock = createFetchQueue([
    jsonResponse({ status: 'queued', request_id: 'request-4' }),
    jsonResponse({
      status: 'failed',
      request_id: 'request-4',
      error: 'Provider unavailable',
    }),
  ])

  const client = createHiggsfield({
    ...credentials,
    fetch: mock.fetch,
    polling: { intervalMs: 0, maxIntervalMs: 0, jitterRatio: 0 },
  })

  await assert.rejects(
    client.generate({
      model: 'higgsfield/soul-standard',
      prompt: 'A studio portrait',
    }),
    (error) => {
      assert.ok(error instanceof HiggsfieldGenerationError)
      assert.equal(error.response.status, 'failed')
      return true
    },
  )
})

test('does not retry generation POST requests by default', async () => {
  const mock = createFetchQueue([
    jsonResponse({ message: 'unavailable' }, { status: 503 }),
  ])

  const client = createHiggsfield({
    ...credentials,
    fetch: mock.fetch,
    retry: { maxRetries: 5 },
  })

  await assert.rejects(
    client.submit({
      model: 'higgsfield/soul-standard',
      prompt: 'Portrait',
    }),
    HiggsfieldApiError,
  )

  assert.equal(mock.calls.length, 1)
})

test('retries retryable GET status requests', async () => {
  const mock = createFetchQueue([
    jsonResponse({ message: 'unavailable' }, { status: 503 }),
    jsonResponse({ status: 'completed', request_id: 'request-5' }),
  ])

  const client = createHiggsfield({
    ...credentials,
    fetch: mock.fetch,
    retry: {
      maxRetries: 1,
      initialDelayMs: 1,
      maxDelayMs: 1,
      jitterRatio: 0,
    },
  })

  const result = await client.getStatus('request-5')
  assert.equal(result.status, 'completed')
  assert.equal(mock.calls.length, 2)
})

test('validates known model inputs before network I/O', async () => {
  const mock = createFetchQueue([])
  const client = createHiggsfield({ ...credentials, fetch: mock.fetch })

  await assert.rejects(
    client.submit({
      model: 'higgsfield/dop-lite',
      image_url: 'not-a-url',
      prompt: '',
    }),
    HiggsfieldValidationError,
  )

  assert.equal(mock.calls.length, 0)
})
