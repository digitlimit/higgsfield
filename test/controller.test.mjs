import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createHiggsfield,
  HiggsfieldTimeoutError,
} from '../dist/index.js'
import { createFetchQueue, jsonResponse } from './helpers.mjs'

const credentials = { apiKey: 'key', apiSecret: 'secret' }

test('manages an existing request without resubmitting it', async () => {
  const mock = createFetchQueue([
    jsonResponse({ status: 'completed', request_id: 'existing-1' }),
  ])
  const client = createHiggsfield({ ...credentials, fetch: mock.fetch })
  const result = await client.controller('existing-1').get({ intervalMs: 0 })

  assert.equal(result.status, 'completed')
  assert.equal(mock.calls.length, 1)
  assert.match(mock.calls[0].input, /requests\/existing-1\/status$/)
})

test('stops polling after maxAttempts', async () => {
  const mock = createFetchQueue([
    jsonResponse({ status: 'queued', request_id: 'existing-2' }),
    jsonResponse({ status: 'queued', request_id: 'existing-2' }),
  ])
  const client = createHiggsfield({
    ...credentials,
    fetch: mock.fetch,
    polling: { intervalMs: 0, maxIntervalMs: 0, jitterRatio: 0 },
  })

  await assert.rejects(
    client.controller('existing-2').get({ maxAttempts: 2, emitUnchangedStatus: true }),
    HiggsfieldTimeoutError,
  )
})

test('cancels a queued request', async () => {
  const mock = createFetchQueue([
    new Response(null, { status: 202 }),
  ])
  const client = createHiggsfield({ ...credentials, fetch: mock.fetch })

  await client.controller('request-cancel').cancel()
  assert.equal(mock.calls[0].init.method, 'POST')
  assert.match(mock.calls[0].input, /requests\/request-cancel\/cancel$/)
})

test('exposes direct status, poll, wait and getResult helpers', async () => {
  const mock = createFetchQueue([
    jsonResponse({ status: 'queued', request_id: 'existing-helpers' }),
    jsonResponse({ status: 'in_progress', request_id: 'existing-helpers' }),
    jsonResponse({
      status: 'completed',
      request_id: 'existing-helpers',
      images: [{ url: 'https://cdn.example.test/result.jpg' }],
    }),
  ])
  const client = createHiggsfield({
    ...credentials,
    fetch: mock.fetch,
    polling: { intervalMs: 0, maxIntervalMs: 0, jitterRatio: 0 },
  })

  const first = await client.status('existing-helpers')
  assert.equal(first.status, 'queued')

  const statuses = []
  for await (const item of client.poll('existing-helpers', { emitUnchangedStatus: true })) {
    statuses.push(item.status)
  }

  assert.deepEqual(statuses, ['in_progress', 'completed'])
})
