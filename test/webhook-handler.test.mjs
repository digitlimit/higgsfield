import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createWebhookHandler,
  MemoryWebhookIdempotencyStore,
} from '../dist/index.js'

const completedPayload = JSON.stringify({
  status: 'completed',
  request_id: 'webhook-handler-1',
  images: [{ url: 'https://cdn.example.test/image.jpg' }],
})

test('handles a webhook through the framework-neutral adapter', async () => {
  const events = []
  const webhook = createWebhookHandler({
    onEvent: (event) => events.push(event),
  })

  const result = await webhook.handle({
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: completedPayload,
  })

  assert.equal(result.statusCode, 200)
  assert.equal(result.event.status, 'completed')
  assert.equal(events.length, 1)
  assert.deepEqual(JSON.parse(result.body), {
    received: true,
    request_id: 'webhook-handler-1',
    status: 'completed',
  })
})

test('routes terminal statuses to status-specific handlers', async () => {
  let failed = 0
  const webhook = createWebhookHandler({
    handlers: {
      failed: (event) => {
        failed += 1
        assert.equal(event.error, 'Provider unavailable')
      },
    },
  })

  const result = await webhook.handle({
    body: {
      status: 'failed',
      request_id: 'webhook-handler-failed',
      error: 'Provider unavailable',
    },
  })

  assert.equal(result.statusCode, 200)
  assert.equal(failed, 1)
})

test('deduplicates webhook retries using an idempotency store', async () => {
  const store = new MemoryWebhookIdempotencyStore()
  let calls = 0
  const webhook = createWebhookHandler({
    idempotency: store,
    onEvent: () => {
      calls += 1
    },
  })

  const first = await webhook.handle({ body: completedPayload })
  const second = await webhook.handle({ body: completedPayload })

  assert.equal(first.duplicate, false)
  assert.equal(second.duplicate, true)
  assert.equal(calls, 1)
})

test('releases an idempotency reservation when the application handler fails', async () => {
  const store = new MemoryWebhookIdempotencyStore()
  let attempts = 0
  const webhook = createWebhookHandler({
    idempotency: store,
    onEvent: () => {
      attempts += 1
      if (attempts === 1) {
        throw new Error('Database unavailable')
      }
    },
  })

  const failed = await webhook.handle({ body: completedPayload })
  const retried = await webhook.handle({ body: completedPayload })

  assert.equal(failed.statusCode, 500)
  assert.equal(retried.statusCode, 200)
  assert.equal(attempts, 2)
})

test('rejects methods other than POST', async () => {
  const webhook = createWebhookHandler()
  const result = await webhook.handle({ method: 'GET', body: '' })

  assert.equal(result.statusCode, 405)
  assert.equal(result.headers.allow, 'POST')
})

test('supports the dependency-free Node HTTP adapter', async () => {
  const chunks = [new TextEncoder().encode(completedPayload)]
  const request = {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    async *[Symbol.asyncIterator]() {
      yield* chunks
    },
  }
  const response = {
    statusCode: 0,
    headers: {},
    body: undefined,
    setHeader(name, value) {
      this.headers[name] = value
    },
    end(body) {
      this.body = body
    },
  }

  const webhook = createWebhookHandler()
  await webhook.handleNode(request, response)

  assert.equal(response.statusCode, 200)
  assert.equal(response.headers['content-type'], 'application/json; charset=utf-8')
  assert.equal(JSON.parse(response.body).received, true)
})
